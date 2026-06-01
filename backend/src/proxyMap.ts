/**
 * Maps public aiplatform.googleapis.com URLs to the authenticated
 * aiplatform.clients6.google.com endpoints the proxy forwards to.
 *
 * Everything here is pure and dependency-free so it can be unit-tested.
 */

export interface ProxyContext {
  projectId: string;
  region: string;
}

export interface TransformResult {
  result: string | null;
  inProgress: boolean;
}

export interface PatternInfo {
  regex: RegExp;
  params: string[];
}

export interface ApiClient {
  name: string;
  patternForProxy: string;
  getApiEndpoint: (context: ProxyContext, params: Record<string, string>) => string;
  isStreaming: boolean;
  transformFn: ((response: string) => TransformResult) | null;
  patternInfo: PatternInfo;
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function parsePattern(pattern: string): PatternInfo {
  const paramRegex = /\{\{(.*?)\}\}/g;
  const params: string[] = [];
  const parts: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = paramRegex.exec(pattern)) !== null) {
    params.push(match[1]);
    const literalPart = pattern.substring(lastIndex, match.index);
    parts.push(escapeRegex(literalPart));
    parts.push(`(?<${match[1]}>[^/]+)`);
    lastIndex = paramRegex.lastIndex;
  }
  parts.push(escapeRegex(pattern.substring(lastIndex)));
  const regexString = parts.join('');

  return { regex: new RegExp(`^${regexString}$`), params };
}

export function extractParams(
  patternInfo: PatternInfo,
  url: string,
): Record<string, string> | null {
  const match = url.match(patternInfo.regex);
  if (!match) return null;
  const params: Record<string, string> = {};
  // Named capture groups also populate positional slots, so index-based
  // access is correct here.
  patternInfo.params.forEach((paramName, index) => {
    params[paramName] = match[index + 1];
  });
  return params;
}

/**
 * Unwraps the JSON-array framing Vertex uses for streamGenerateContent and
 * re-emits each complete object as an SSE `data: {...}` frame. Returns
 * `inProgress: true` while a chunk is still partial.
 */
export function streamGenerateContentTransform(response: string): TransformResult {
  let normalizedResponse = response.trim();
  while (normalizedResponse.startsWith(',') || normalizedResponse.startsWith('[')) {
    normalizedResponse = normalizedResponse.substring(1).trim();
  }
  while (normalizedResponse.endsWith(',') || normalizedResponse.endsWith(']')) {
    normalizedResponse = normalizedResponse.substring(0, normalizedResponse.length - 1).trim();
  }

  if (!normalizedResponse.length) {
    return { result: null, inProgress: false };
  }

  if (!normalizedResponse.endsWith('}')) {
    return { result: normalizedResponse, inProgress: true };
  }

  try {
    const parsedResponse = JSON.parse(`${normalizedResponse}`);
    const transformedResponse = `data: ${JSON.stringify(parsedResponse)}\n\n`;
    return { result: transformedResponse, inProgress: false };
  } catch (error) {
    throw new Error(`Failed to parse response: ${error}.`);
  }
}

const RAW_CLIENTS: Omit<ApiClient, 'patternInfo'>[] = [
  {
    name: 'VertexGenAi:generateContent',
    patternForProxy:
      'https://aiplatform.googleapis.com/{{version}}/publishers/google/models/{{model}}:generateContent',
    getApiEndpoint: (context, params) =>
      `https://aiplatform.clients6.google.com/${params['version']}/projects/${context.projectId}/locations/${context.region}/publishers/google/models/${params['model']}:generateContent`,
    isStreaming: false,
    transformFn: null,
  },
  {
    name: 'VertexGenAi:predict',
    patternForProxy:
      'https://aiplatform.googleapis.com/{{version}}/publishers/google/models/{{model}}:predict',
    getApiEndpoint: (context, params) =>
      `https://aiplatform.clients6.google.com/${params['version']}/projects/${context.projectId}/locations/${context.region}/publishers/google/models/${params['model']}:predict`,
    isStreaming: false,
    transformFn: null,
  },
  {
    name: 'VertexGenAi:streamGenerateContent',
    patternForProxy:
      'https://aiplatform.googleapis.com/{{version}}/publishers/google/models/{{model}}:streamGenerateContent',
    getApiEndpoint: (context, params) =>
      `https://aiplatform.clients6.google.com/${params['version']}/projects/${context.projectId}/locations/${context.region}/publishers/google/models/${params['model']}:streamGenerateContent`,
    isStreaming: true,
    transformFn: streamGenerateContentTransform,
  },
  {
    name: 'ReasoningEngine:query',
    patternForProxy:
      'https://{{endpoint_location}}-aiplatform.googleapis.com/{{version}}/projects/{{project_id}}/locations/{{location_id}}/reasoningEngines/{{engine_id}}:query',
    getApiEndpoint: (_context, params) =>
      `https://${params['endpoint_location']}-aiplatform.clients6.google.com/v1beta1/projects/${params['project_id']}/locations/${params['location_id']}/reasoningEngines/${params['engine_id']}:query`,
    isStreaming: false,
    transformFn: null,
  },
  {
    name: 'ReasoningEngine:streamQuery',
    patternForProxy:
      'https://{{endpoint_location}}-aiplatform.googleapis.com/{{version}}/projects/{{project_id}}/locations/{{location_id}}/reasoningEngines/{{engine_id}}:streamQuery',
    getApiEndpoint: (_context, params) =>
      `https://${params['endpoint_location']}-aiplatform.clients6.google.com/v1beta1/projects/${params['project_id']}/locations/${params['location_id']}/reasoningEngines/${params['engine_id']}:streamQuery`,
    isStreaming: true,
    transformFn: null,
  },
];

export const API_CLIENT_MAP: ApiClient[] = RAW_CLIENTS.map((client) => ({
  ...client,
  patternInfo: parsePattern(client.patternForProxy),
}));

export function matchApiClient(
  originalUrl: string,
): { client: ApiClient; params: Record<string, string> } | null {
  for (const client of API_CLIENT_MAP) {
    const params = extractParams(client.patternInfo, originalUrl);
    if (params !== null) return { client, params };
  }
  return null;
}
