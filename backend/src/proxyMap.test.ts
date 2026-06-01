import { describe, it, expect } from 'vitest';
import {
  parsePattern,
  extractParams,
  matchApiClient,
  streamGenerateContentTransform,
  API_CLIENT_MAP,
} from './proxyMap.js';

describe('parsePattern / extractParams', () => {
  it('captures named params from a pattern', () => {
    const info = parsePattern('https://host/{{version}}/models/{{model}}:generateContent');
    expect(info.params).toEqual(['version', 'model']);
    const params = extractParams(info, 'https://host/v1/models/gemini-2.5-flash:generateContent');
    expect(params).toEqual({ version: 'v1', model: 'gemini-2.5-flash' });
  });

  it('returns null when the URL does not match', () => {
    const info = parsePattern('https://host/{{version}}/x');
    expect(extractParams(info, 'https://host/v1/y')).toBeNull();
  });

  it('does not let a param span a path separator', () => {
    const info = parsePattern('https://host/{{model}}:predict');
    expect(extractParams(info, 'https://host/a/b:predict')).toBeNull();
  });
});

describe('matchApiClient + getApiEndpoint', () => {
  const ctx = { projectId: 'my-proj', region: 'us-central1' };

  it('routes generateContent to the authenticated endpoint', () => {
    const url = 'https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash:generateContent';
    const matched = matchApiClient(url);
    expect(matched?.client.name).toBe('VertexGenAi:generateContent');
    expect(matched?.client.getApiEndpoint(ctx, matched.params)).toBe(
      'https://aiplatform.clients6.google.com/v1/projects/my-proj/locations/us-central1/publishers/google/models/gemini-2.5-flash:generateContent',
    );
  });

  it('routes streamGenerateContent and marks it streaming with a transform', () => {
    const url = 'https://aiplatform.googleapis.com/v1/publishers/google/models/m:streamGenerateContent';
    const matched = matchApiClient(url);
    expect(matched?.client.name).toBe('VertexGenAi:streamGenerateContent');
    expect(matched?.client.isStreaming).toBe(true);
    expect(typeof matched?.client.transformFn).toBe('function');
  });

  it('routes ReasoningEngine query with a regional host', () => {
    const url =
      'https://us-central1-aiplatform.googleapis.com/v1beta1/projects/p/locations/us-central1/reasoningEngines/123:query';
    const matched = matchApiClient(url);
    expect(matched?.client.name).toBe('ReasoningEngine:query');
    expect(matched?.params).toMatchObject({
      endpoint_location: 'us-central1',
      project_id: 'p',
      location_id: 'us-central1',
      engine_id: '123',
    });
  });

  it('returns null for an unknown URL', () => {
    expect(matchApiClient('https://example.com/foo')).toBeNull();
  });

  it('registers all five known clients', () => {
    expect(API_CLIENT_MAP.map((c) => c.name)).toEqual([
      'VertexGenAi:generateContent',
      'VertexGenAi:predict',
      'VertexGenAi:streamGenerateContent',
      'ReasoningEngine:query',
      'ReasoningEngine:streamQuery',
    ]);
  });
});

describe('streamGenerateContentTransform', () => {
  it('unwraps a complete JSON-array element into an SSE frame', () => {
    const out = streamGenerateContentTransform('[{"a":1}]');
    expect(out.inProgress).toBe(false);
    expect(out.result).toBe('data: {"a":1}\n\n');
  });

  it('strips a leading comma between array elements', () => {
    const out = streamGenerateContentTransform(',{"b":2}');
    expect(out.inProgress).toBe(false);
    expect(out.result).toBe('data: {"b":2}\n\n');
  });

  it('reports inProgress for a partial chunk', () => {
    const out = streamGenerateContentTransform('{"a":');
    expect(out.inProgress).toBe(true);
    expect(out.result).toBe('{"a":');
  });

  it('returns null result for empty array framing', () => {
    expect(streamGenerateContentTransform('[]')).toEqual({ result: null, inProgress: false });
  });
});
