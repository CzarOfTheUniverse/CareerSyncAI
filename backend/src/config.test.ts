import { describe, it, expect } from 'vitest';
import { loadConfig, toPublicConfig } from './config.js';

const base = {
  GOOGLE_CLOUD_PROJECT: 'proj',
  GOOGLE_CLOUD_LOCATION: 'global',
  PROXY_HEADER: 'secret',
} as NodeJS.ProcessEnv;

describe('loadConfig', () => {
  it('throws when a required variable is missing', () => {
    expect(() => loadConfig({ GOOGLE_CLOUD_PROJECT: 'p' } as NodeJS.ProcessEnv)).toThrow(
      /GOOGLE_CLOUD_LOCATION/,
    );
  });

  it('applies sensible defaults', () => {
    const cfg = loadConfig({ ...base });
    expect(cfg.port).toBe(5000);
    expect(cfg.host).toBe('127.0.0.1');
    expect(cfg.geminiModel).toBe('gemini-2.5-flash');
    expect(cfg.lookbackDaysDefault).toBe(90);
    expect(cfg.authEnforced).toBe(false);
  });

  it('parses and normalises the email allow-list', () => {
    const cfg = loadConfig({ ...base, ALLOWED_EMAILS: ' A@X.com , b@y.com ' });
    expect(cfg.allowedEmails).toEqual(['a@x.com', 'b@y.com']);
    expect(cfg.authEnforced).toBe(true);
  });

  it('enables enforcement when only a hosted domain is set', () => {
    const cfg = loadConfig({ ...base, ALLOWED_HOSTED_DOMAIN: 'Example.com' });
    expect(cfg.allowedHostedDomain).toBe('example.com');
    expect(cfg.authEnforced).toBe(true);
  });
});

describe('toPublicConfig', () => {
  it('exposes only browser-safe fields', () => {
    const cfg = loadConfig({ ...base, GOOGLE_OAUTH_CLIENT_ID: 'cid', ALLOWED_EMAILS: 'a@x.com' });
    expect(toPublicConfig(cfg)).toEqual({
      googleClientId: 'cid',
      geminiModel: 'gemini-2.5-flash',
      lookbackDaysDefault: 90,
      authRequired: true,
    });
  });
});
