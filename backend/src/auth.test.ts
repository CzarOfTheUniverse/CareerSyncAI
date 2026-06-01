import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node-fetch', () => ({ default: vi.fn() }));

import fetch from 'node-fetch';
import { isAllowed, verifyUserAccessToken, _clearTokenCache } from './auth.js';

const mockFetch = fetch as unknown as ReturnType<typeof vi.fn>;

describe('isAllowed', () => {
  it('allows a listed email', () => {
    expect(isAllowed({ email: 'a@x.com' }, ['a@x.com'], '')).toBe(true);
  });
  it('allows a matching hosted domain', () => {
    expect(isAllowed({ email: 'a@x.com', hd: 'x.com' }, [], 'x.com')).toBe(true);
  });
  it('rejects an unlisted user', () => {
    expect(isAllowed({ email: 'a@x.com', hd: 'x.com' }, ['b@y.com'], 'z.com')).toBe(false);
  });
});

describe('verifyUserAccessToken', () => {
  beforeEach(() => {
    _clearTokenCache();
    mockFetch.mockReset();
  });

  it('returns null for an empty token without calling Google', async () => {
    expect(await verifyUserAccessToken('')).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns the lower-cased email for a valid token', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ email: 'User@X.com', hd: 'X.com' }) });
    expect(await verifyUserAccessToken('tok')).toEqual({ email: 'user@x.com', hd: 'x.com' });
  });

  it('caches the result so a second call does not re-hit Google', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ email: 'a@x.com' }) });
    await verifyUserAccessToken('tok');
    await verifyUserAccessToken('tok');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns null when Google rejects the token', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) });
    expect(await verifyUserAccessToken('bad')).toBeNull();
  });
});
