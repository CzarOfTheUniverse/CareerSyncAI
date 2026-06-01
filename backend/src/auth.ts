/**
 * Two kinds of auth live here:
 *  1. Service / ADC credentials used to call Vertex AI (getAccessToken).
 *  2. End-user verification: we validate the Google access token the browser
 *     obtained and check the resulting email against the operator allow-list.
 *     This is the real access boundary for a shared self-host URL — the
 *     client-visible PROXY_HEADER cannot gate access on its own.
 */
import { GoogleAuth } from 'google-auth-library';
import fetch from 'node-fetch';

const auth = new GoogleAuth({
  // cloud-platform is required for Vertex AI predict/generateContent.
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

/** Fetches an ADC/service-account bearer token, or null if creds are missing. */
export async function getAccessToken(): Promise<string | null> {
  try {
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    return token.token ?? null;
  } catch (error) {
    console.error('[auth] Failed to obtain Application Default Credentials:', error);
    return null;
  }
}

export function getRequestHeaders(
  accessToken: string,
  project: string,
): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'X-Goog-User-Project': project,
    'Content-Type': 'application/json',
  };
}

export interface UserInfo {
  email: string;
  hd?: string;
}

interface CacheEntry {
  info: UserInfo;
  exp: number;
}

const TOKEN_TTL_MS = 5 * 60 * 1000;
const tokenCache = new Map<string, CacheEntry>();

/**
 * Verifies a Google OAuth access token by calling the userinfo endpoint and
 * returns the user's email (+ hosted domain). Results are cached briefly so a
 * burst of proxied calls does not hit Google once per request.
 */
export async function verifyUserAccessToken(token: string): Promise<UserInfo | null> {
  if (!token) return null;
  const now = Date.now();
  const hit = tokenCache.get(token);
  if (hit && hit.exp > now) return hit.info;

  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { email?: string; hd?: string };
    if (!data.email) return null;
    const info: UserInfo = { email: data.email.toLowerCase(), hd: data.hd?.toLowerCase() };
    tokenCache.set(token, { info, exp: now + TOKEN_TTL_MS });
    if (tokenCache.size > 1000) {
      for (const key of tokenCache.keys()) {
        tokenCache.delete(key);
        if (tokenCache.size <= 500) break;
      }
    }
    return info;
  } catch (error) {
    console.error('[auth] userinfo lookup failed:', error);
    return null;
  }
}

export function isAllowed(
  info: UserInfo,
  allowedEmails: string[],
  allowedHostedDomain: string,
): boolean {
  if (allowedEmails.includes(info.email)) return true;
  if (allowedHostedDomain && info.hd === allowedHostedDomain) return true;
  return false;
}

/** Test seam: clear the verification cache between tests. */
export function _clearTokenCache(): void {
  tokenCache.clear();
}
