import { describe, it, expect, vi } from 'vitest';

// Stub the SDK so importing the service does not construct a real client.
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent: vi.fn() };
  },
  Type: {
    OBJECT: 'OBJECT',
    STRING: 'STRING',
    ARRAY: 'ARRAY',
    BOOLEAN: 'BOOLEAN',
    NUMBER: 'NUMBER',
  },
}));

import { fallbackParse } from './geminiService';

describe('fallbackParse', () => {
  it('detects interview status', () => {
    const r = fallbackParse('We would like to schedule an interview with you.');
    expect(r.status).toBe('Interviewing');
    expect(r.isJobApplication).toBe(true);
  });

  it('detects offer status', () => {
    expect(fallbackParse('We are thrilled to offer you the position').status).toBe('Offered');
  });

  it('flags obvious marketing as not a job application', () => {
    const r = fallbackParse('Newsletter: 50% off, unsubscribe anytime. Deal of the day!');
    expect(r.isJobApplication).toBe(false);
  });

  it('never fabricates company or jobTitle', () => {
    const r = fallbackParse('Some ambiguous email body.');
    expect(r.company).toBeUndefined();
    expect(r.jobTitle).toBeUndefined();
  });
});
