/**
 * Decodes a Gmail API message payload (base64url, possibly multipart) into
 * plain text. Walks nested MIME parts and falls back to '' when there is no
 * decodable body. Extracted from the scan pipeline so it can be unit-tested.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function decodeGmailBody(payload: any): string {
  if (!payload) return '';
  if (payload.body && payload.body.data) {
    try {
      const base64 = payload.body.data.replace(/-/g, '+').replace(/_/g, '/');
      return decodeURIComponent(escape(atob(base64)));
    } catch (e) {
      return '';
    }
  }
  if (payload.parts) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return payload.parts.map((part: any) => decodeGmailBody(part)).join('\n');
  }
  return '';
}
