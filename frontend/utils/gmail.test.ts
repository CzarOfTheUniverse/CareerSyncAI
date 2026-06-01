import { describe, it, expect } from 'vitest';
import { decodeGmailBody } from './gmail';

const b64url = (s: string): string =>
  Buffer.from(s, 'utf-8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

describe('decodeGmailBody', () => {
  it('decodes a base64url single-part body', () => {
    expect(decodeGmailBody({ body: { data: b64url('Hello world') } })).toBe('Hello world');
  });

  it('joins nested MIME parts with newlines', () => {
    const payload = {
      parts: [{ body: { data: b64url('Part A') } }, { body: { data: b64url('Part B') } }],
    };
    expect(decodeGmailBody(payload)).toBe('Part A\nPart B');
  });

  it('returns empty string for an empty or bodyless payload', () => {
    expect(decodeGmailBody(null)).toBe('');
    expect(decodeGmailBody({})).toBe('');
    expect(decodeGmailBody({ body: {} })).toBe('');
  });
});
