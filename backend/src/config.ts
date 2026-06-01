/**
 * Loads and validates backend configuration from the environment.
 *
 * `loadConfig` throws on a missing required variable rather than calling
 * process.exit, so it can be unit-tested. The runnable entry point
 * (`index.ts`) catches the error and exits.
 */

export interface AppConfig {
  host: string;
  port: number;
  payloadMaxSize: string;
  googleCloudProject: string;
  googleCloudLocation: string;
  proxyHeader: string;
  /** Single app-owned OAuth client ID served to the frontend via /config. */
  googleOAuthClientId: string;
  geminiModel: string;
  lookbackDaysDefault: number;
  /** Lower-cased allow-list of user emails permitted to use the proxy. */
  allowedEmails: string[];
  /** Lower-cased Google Workspace hosted-domain (hd claim) allow-list entry. */
  allowedHostedDomain: string;
  /** True when an allow-list is configured and user auth must be enforced. */
  authEnforced: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const req = (name: string): string => {
    const v = env[name];
    if (!v) throw new Error(`Missing required environment variable: ${name}`);
    return v;
  };
  const opt = (name: string, def: string): string => env[name] ?? def;
  const list = (name: string): string[] =>
    opt(name, '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

  const allowedEmails = list('ALLOWED_EMAILS');
  const allowedHostedDomain = opt('ALLOWED_HOSTED_DOMAIN', '').trim().toLowerCase();

  return {
    host: opt('API_BACKEND_HOST', '127.0.0.1'),
    port: Number(opt('API_BACKEND_PORT', '5000')),
    payloadMaxSize: opt('API_PAYLOAD_MAX_SIZE', '7mb'),
    googleCloudProject: req('GOOGLE_CLOUD_PROJECT'),
    googleCloudLocation: req('GOOGLE_CLOUD_LOCATION'),
    proxyHeader: req('PROXY_HEADER'),
    googleOAuthClientId: opt('GOOGLE_OAUTH_CLIENT_ID', ''),
    geminiModel: opt('GEMINI_MODEL', 'gemini-2.5-flash'),
    lookbackDaysDefault: Number(opt('LOOKBACK_DAYS_DEFAULT', '90')),
    allowedEmails,
    allowedHostedDomain,
    authEnforced: allowedEmails.length > 0 || allowedHostedDomain.length > 0,
  };
}

/** Shape returned by GET /config — safe to expose to the browser. */
export interface PublicConfig {
  googleClientId: string;
  geminiModel: string;
  lookbackDaysDefault: number;
  authRequired: boolean;
}

export function toPublicConfig(config: AppConfig): PublicConfig {
  return {
    googleClientId: config.googleOAuthClientId,
    geminiModel: config.geminiModel,
    lookbackDaysDefault: config.lookbackDaysDefault,
    authRequired: config.authEnforced,
  };
}
