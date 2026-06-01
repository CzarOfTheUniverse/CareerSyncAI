/**
 * Pure helpers for the Gmail → job deduplication pipeline.
 *
 * IMPORTANT: this module mirrors the dedup helpers defined inline in
 * `triggerRealGmailScan` in App.tsx. They are duplicated here (not yet imported
 * back) so the algorithm can be unit-tested in isolation; keep the two copies in
 * sync until the scan pipeline is refactored to import from here. See CLAUDE.md
 * for the four-step cascade these feed.
 */

/** Strips requisition IDs / job codes / trailing reference numbers from titles. */
export const cleanJobTitle = (t: string): string =>
  t
    .replace(/\s*[\-—–|(\[]\s*(R|JR|REQ|Req|JOB|Ref|#)[\s\-:]*[A-Z0-9]*\d{2,}[\s)\]]*$/i, '')
    .replace(/\s*\(\s*(req|requisition|job|ref)[\s\-:#]*\d+\s*\)/i, '')
    .replace(/\s*#?\d{4,}\s*$/, '')
    .trim();

/** Rank / seniority words that should not affect role identity. */
export const RANK_TOKENS = new Set([
  'sr', 'senior', 'jr', 'junior', 'principal', 'lead', 'staff',
  'associate', 'entry', 'i', 'ii', 'iii', 'iv', 'v',
]);

/** Common abbreviation expansions so "Tech"/"SW" match "Technical"/"Software". */
export const ABBREV_MAP: Record<string, string> = {
  tech: 'technical',
  sw: 'software',
  eng: 'engineer',
  engr: 'engineer',
  mgr: 'manager',
  dev: 'developer',
};

/** Significant tokens of a title: cleaned, abbreviation-expanded, rank-stripped. */
export const titleTokens = (jobTitle: string): Set<string> => {
  const cleaned = cleanJobTitle(jobTitle).toLowerCase();
  const tokens = cleaned
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((t) => ABBREV_MAP[t] || t)
    .filter((t) => !RANK_TOKENS.has(t));
  return new Set(tokens);
};

/** Order-independent signature used for exact title matching. */
export const titleSignature = (jobTitle: string): string =>
  Array.from(titleTokens(jobTitle)).sort().join('');

/** Normalises a company name so "Stoke Games, Inc." === "stokegamesinc". */
export const companyKey = (company: string): string =>
  company.toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Exact dedup key: normalized company + title signature. */
export const dedupKeyFor = (company: string, jobTitle: string): string =>
  `${companyKey(company)}::${titleSignature(jobTitle)}`;

/**
 * True when one title's significant tokens are wholly contained in the other's
 * (e.g. "Principal Technical Artist" ⊂ "Principal Technical Artist, Games R&D").
 * The smaller set must have ≥2 tokens to avoid trivial matches like bare "Engineer".
 */
export const isSubsetMatch = (a: Set<string>, b: Set<string>): boolean => {
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  if (smaller.size < 2) return false;
  for (const tok of smaller) if (!larger.has(tok)) return false;
  return true;
};

/** Status precedence used when merging: later stages win; Archived is lowest. */
export const statusRank: Record<string, number> = {
  Applied: 1,
  Interviewing: 2,
  Offered: 3,
  Rejected: 3,
  Archived: 0,
};
