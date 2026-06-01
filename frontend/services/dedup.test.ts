import { describe, it, expect } from 'vitest';
import {
  cleanJobTitle,
  titleTokens,
  titleSignature,
  companyKey,
  dedupKeyFor,
  isSubsetMatch,
  statusRank,
} from './dedup';

describe('cleanJobTitle', () => {
  it('strips requisition IDs and job codes', () => {
    expect(cleanJobTitle('Senior Tools Engineer (JR12345)')).toBe('Senior Tools Engineer');
    expect(cleanJobTitle('Advanced Environment Technical Artist - R000101539')).toBe(
      'Advanced Environment Technical Artist',
    );
  });
});

describe('companyKey', () => {
  it('collapses punctuation/case variants', () => {
    expect(companyKey('Stoke Games, Inc.')).toBe('stokegamesinc');
    expect(companyKey('stoke.games')).toBe('stokegames');
  });
});

describe('titleSignature', () => {
  it('drops rank/seniority words and is order-independent', () => {
    expect(titleSignature('Senior Technical Artist')).toBe(titleSignature('Technical Artist'));
    expect(titleSignature('Principal Technical Artist')).toBe(titleSignature('Technical Artist'));
  });

  it('expands abbreviations so variants match', () => {
    expect(titleSignature('Sr SW Engineer')).toBe(titleSignature('Software Engineer'));
    expect(titleSignature('Tech Artist')).toBe(titleSignature('Technical Artist'));
  });
});

describe('isSubsetMatch', () => {
  it('treats a more-specific title as matching a less-specific one', () => {
    const broad = titleTokens('Technical Artist');
    const specific = titleTokens('Principal Character Technical Artist');
    expect(isSubsetMatch(broad, specific)).toBe(true);
  });

  it('does not match on a single shared token', () => {
    expect(isSubsetMatch(titleTokens('Engineer'), titleTokens('Software Engineer'))).toBe(false);
  });
});

describe('dedupKeyFor', () => {
  it('combines normalized company and title signature', () => {
    expect(dedupKeyFor('Stoke Games', 'Senior Technical Artist')).toBe(
      dedupKeyFor('stoke.games', 'Technical Artist'),
    );
  });
});

describe('statusRank', () => {
  it('orders stages so later stages win, Archived lowest', () => {
    expect(statusRank.Applied).toBeLessThan(statusRank.Interviewing);
    expect(statusRank.Interviewing).toBeLessThan(statusRank.Offered);
    expect(statusRank.Offered).toBe(statusRank.Rejected);
    expect(statusRank.Archived).toBe(0);
  });
});
