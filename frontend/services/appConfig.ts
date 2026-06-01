/**
 * Runtime configuration served by the backend (GET /config). This is how the
 * operator's single OAuth client ID and Gemini model reach the browser without
 * baking them into the build — set the env vars, restart the backend, done.
 */
export interface PublicConfig {
  googleClientId: string;
  geminiModel: string;
  lookbackDaysDefault: number;
  authRequired: boolean;
}

export async function fetchAppConfig(): Promise<PublicConfig | null> {
  try {
    const res = await fetch('/config');
    if (!res.ok) return null;
    return (await res.json()) as PublicConfig;
  } catch {
    // No backend / offline (e.g. pure demo use) — fall back to manual config.
    return null;
  }
}
