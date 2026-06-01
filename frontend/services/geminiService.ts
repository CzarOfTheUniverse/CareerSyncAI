import { GoogleGenAI, Type } from '@google/genai';
import type { JobApplication, JobStatus } from '../types';

// Initialize the Gemini API client. Real auth happens via the backend proxy +
// ADC, not via this key (see vite.config.ts) — the SDK just requires the field.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '', vertexai: true });

// Active model. Defaults to gemini-2.5-flash; the operator can override it at
// deploy time via the backend /config endpoint (GEMINI_MODEL). The app calls
// configureGemini() once the runtime config has loaded.
let MODEL = 'gemini-2.5-flash';

export function configureGemini(opts: { model?: string }): void {
  if (opts.model) MODEL = opts.model;
}

/**
 * Helper function to call Gemini API with exponential backoff retry logic.
 */
async function callGeminiWithRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries <= 0) {
      throw error;
    }
    // Check if it's a rate limit (429) or server error (5xx)
    const status = error?.status || error?.statusCode;
    const isRateLimitOrServerError = !status || status === 429 || (status >= 500 && status < 600);
    
    if (isRateLimitOrServerError) {
      console.warn(`Gemini API call failed. Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callGeminiWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

export type ParsedEmailResult = Partial<JobApplication> & { isJobApplication?: boolean };

export interface EmailToParse {
  id: string;
  sender: string;
  subject: string;
  date: string;
  body: string;
}

export type ParsedBatchResult = ParsedEmailResult & { id: string };

const PARSE_INSTRUCTIONS = `For each email decide whether it is a genuine job-application correspondence directed at the recipient (application confirmation, recruiter outreach, interview scheduling, offer, rejection). Set isJobApplication=false for newsletters, marketing, credit/financial offers, travel deals, generic "we're hiring" job-board blasts, or any email not about the recipient's own application.

If isJobApplication=true, extract:
- company: canonical company name only. Use "Stoke Games" not "stoke.games" or "Stoke Games, Inc.". If multiple emails are about the same employer, use the SAME name every time.
- jobTitle: the SPECIFIC ROLE the recipient applied for (e.g. "Senior Technical Artist", "Principal Character Technical Artist"). It must be a real job title from the email body. NEVER use the email subject, a process stage ("Offer Review", "Interview Stage", "Application Update"), or a generic placeholder. Strip requisition IDs, job codes, ticket numbers, and trailing reference numbers (e.g. write "Advanced Environment Technical Artist", NOT "Advanced Environment Technical Artist - R000101539" or "Senior Tools Engineer (JR12345)"). If the email does not name a specific role, leave jobTitle blank.
- status: exactly one of 'Applied', 'Interviewing', 'Offered', 'Rejected', 'Archived'. Use the MOST RECENT decision in the email body, not whatever earlier stage it mentions in passing. Specifically:
    * 'Rejected' if the email communicates any rejection: phrases like "unfortunately", "we have decided not to move forward", "decided to pursue other candidates", "this position has been filled", "we are unable to offer", "no longer being considered", "won't be moving you forward". A rejection that thanks the candidate for their interviews is STILL Rejected — past interview discussion does not downgrade the status.
    * 'Offered' if the email is making an offer ("pleased to offer", "we'd like to extend an offer", "congratulations on the offer"). Earlier interview discussion in the same email does not downgrade the status.
    * 'Interviewing' if the email is scheduling, confirming, or discussing an interview/assessment and there is no rejection or offer language.
    * 'Applied' if the email is confirming receipt of an application or initial recruiter outreach with no interview scheduled yet.
- date: YYYY-MM-DD.
- Other fields: fill if clearly present, omit otherwise.`;

/**
 * Parse many emails in a single Gemini call. Returns one entry per input
 * email, keyed by id, in any order. Used by the bulk scan path.
 */
export async function parseEmailsBatch(emails: EmailToParse[]): Promise<ParsedBatchResult[]> {
  if (emails.length === 0) return [];
  try {
    const emailBlock = emails
      .map(e => `--- EMAIL id=${e.id} ---\nFrom: ${e.sender}\nSubject: ${e.subject}\nDate: ${e.date}\n\n${e.body}`)
      .join('\n\n');

    const parsedData = await callGeminiWithRetry(async () => {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: `${PARSE_INSTRUCTIONS}\n\nReturn one result per email. Include the exact "id" value you were given so results can be matched back.\n\n${emailBlock}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING, description: 'The exact id of the email this entry corresponds to.' },
                isJobApplication: { type: Type.BOOLEAN, description: 'True only if this is a genuine job-application email about the recipient.' },
                company: { type: Type.STRING, description: 'Canonical company name. Same name across all emails about the same employer.' },
                jobTitle: { type: Type.STRING, description: 'Specific role applied for, from the email body. Never an email subject or stage label.' },
                status: { type: Type.STRING, description: "One of: 'Applied', 'Interviewing', 'Offered', 'Rejected', 'Archived'" },
                contactName: { type: Type.STRING },
                contactEmail: { type: Type.STRING },
                date: { type: Type.STRING, description: 'YYYY-MM-DD' },
                salary: { type: Type.STRING },
                location: { type: Type.STRING },
                nextSteps: { type: Type.STRING },
                summary: { type: Type.STRING, description: '1-2 sentence summary of the email.' },
              },
              required: ['id', 'isJobApplication'],
            },
          },
        },
      });
      return JSON.parse((response.text || '').trim()) as ParsedBatchResult[];
    });
    return parsedData;
  } catch (error) {
    console.error('Error batch-parsing emails with Gemini:', error);
    // Fall back to per-email keyword parse so the caller still gets results.
    return emails.map(e => ({ id: e.id, ...fallbackParse(e.body) }));
  }
}

/**
 * Parses a raw email string and extracts structured job application details.
 */
export async function parseEmailWithGemini(emailText: string): Promise<ParsedEmailResult> {
  try {
    const parsedData = await callGeminiWithRetry(async () => {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: `${PARSE_INSTRUCTIONS}\n\nEmail Content:\n"""\n${emailText}\n"""`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isJobApplication: { type: Type.BOOLEAN, description: 'True only if this is a genuine job-application email about the recipient. False for newsletters, marketing, credit offers, deals, generic job-board blasts.' },
              company: { type: Type.STRING, description: 'Name of the company' },
              jobTitle: { type: Type.STRING, description: 'Job title or position' },
              status: {
                type: Type.STRING,
                description: "Current status of the application based on the email. Must be exactly one of: 'Applied', 'Interviewing', 'Offered', 'Rejected', or 'Archived'"
              },
              contactName: { type: Type.STRING, description: 'Name of the sender or contact person, if found' },
              contactEmail: { type: Type.STRING, description: 'Email address of the contact person or company domain' },
              date: { type: Type.STRING, description: 'Date of the email or application in YYYY-MM-DD format' },
              salary: { type: Type.STRING, description: 'Salary or compensation mentioned, if any' },
              location: { type: Type.STRING, description: 'Location (e.g., Remote, New York, etc.) if mentioned' },
              nextSteps: { type: Type.STRING, description: 'Any next steps mentioned (e.g., "Schedule interview", "Submit assessment", "None")' },
              summary: { type: Type.STRING, description: 'A brief 1-2 sentence summary of the email content' }
            },
            required: ['isJobApplication', 'summary']
          }
        }
      });
      return JSON.parse((response.text || '').trim());
    });
    return parsedData;
  } catch (error) {
    console.error('Error parsing email with Gemini:', error);
    // Fallback parsing logic in case of API failure
    return fallbackParse(emailText);
  }
}

/**
 * Generates a professional follow-up or reply email draft based on the job details.
 */
export async function generateFollowUpEmail(job: JobApplication, tone: 'professional' | 'enthusiastic' | 'formal' = 'professional'): Promise<string> {
  try {
    const prompt = `Draft a high-quality email reply or follow-up for the following job application.
    Company: ${job.company}
    Job Title: ${job.jobTitle}
    Current Status: ${job.status}
    Contact Person: ${job.contactName || 'Hiring Team'}
    Next Steps: ${job.nextSteps || 'N/A'}
    Tone: ${tone}
    
    Provide only the email subject and body. Do not include any other conversational text.`;

    const text = await callGeminiWithRetry(async () => {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: prompt
      });
      return response.text || '';
    });

    return text || 'Failed to generate email draft.';
  } catch (error) {
    console.error('Error generating follow-up email:', error);
    return `Subject: Follow up regarding ${job.jobTitle} application at ${job.company}\n\nDear ${job.contactName || 'Hiring Team'},\n\nI hope this email finds you well. I am writing to follow up on my application for the ${job.jobTitle} position. I remain highly interested in the opportunity and look forward to hearing from you.\n\nBest regards,\n[Your Name]`;
  }
}

/**
 * AI Career Coach chat assistant to answer questions about the user's job hunt.
 */
export async function getJobHuntAdvice(jobs: JobApplication[], query: string): Promise<string> {
  try {
    const jobsSummary = jobs.map(j => `- ${j.company}: ${j.jobTitle} (${j.status}) - Next steps: ${j.nextSteps || 'None'}`).join('\n');
    
    const prompt = `You are an expert career coach and job search assistant. Below is the user's current job application tracker data:
    
    ${jobsSummary}
    
    The user is asking: "${query}"
    
    Provide a helpful, encouraging, and highly actionable response based on their current applications. Keep it concise and professional.`;

    const text = await callGeminiWithRetry(async () => {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: prompt
      });
      return response.text || '';
    });

    return text || 'I am here to help you with your job search!';
  } catch (error) {
    console.error('Error getting job hunt advice:', error);
    return 'Sorry, I encountered an error while processing your request. Please try again.';
  }
}

export interface ResumeJobMatch {
  jobId: string;
  company: string;
  jobTitle: string;
  matchScore: number;
  keyAlignments: string[];
  missingKeywords: string[];
  advice: string;
}

export interface ResumeReviewResult {
  overallScore: number;
  summary: string;
  strengths: string[];
  gaps: string[];
  recommendations: string[];
  jobMatches: ResumeJobMatch[];
}

/**
 * Have Gemini critique the resume against the current job pipeline. Returns a
 * structured review plus per-job alignment scores so the UI can rank fit.
 */
export async function reviewResume(
  resumeText: string,
  jobs: Pick<JobApplication, 'id' | 'company' | 'jobTitle' | 'summary' | 'nextSteps' | 'status'>[]
): Promise<ResumeReviewResult> {
  const trimmed = resumeText.trim();
  if (!trimmed) {
    throw new Error('Resume text is empty.');
  }
  // Cap input so a huge paste doesn't blow the context window. Gemini-2.5-flash
  // has plenty of headroom, but a sane cap keeps latency predictable.
  const RESUME_CAP = 20000;
  const resumeForPrompt = trimmed.length > RESUME_CAP
    ? trimmed.slice(0, RESUME_CAP) + '\n[...truncated]'
    : trimmed;

  const jobsBlock = jobs.slice(0, 40).map(j =>
    `id=${j.id} | ${j.company} — ${j.jobTitle} (${j.status})${j.summary ? `\n  summary: ${j.summary}` : ''}${j.nextSteps ? `\n  nextSteps: ${j.nextSteps}` : ''}`
  ).join('\n');

  const prompt = `You are a senior technical recruiter reviewing a candidate's resume against the roles they are actively pursuing.

RESUME:
"""
${resumeForPrompt}
"""

CURRENT JOB PIPELINE:
${jobsBlock || '(no jobs in pipeline yet — give general review only)'}

Return a JSON review with:
- overallScore: 0-100 estimate of how strong this resume is for the kinds of roles in the pipeline.
- summary: 2-3 sentences, honest and specific.
- strengths: 3-6 concrete strengths grounded in the resume.
- gaps: 3-6 weaknesses or missing signals that recruiters in this space will notice.
- recommendations: 3-6 specific, actionable edits (e.g. "Quantify the Unity migration in bullet 2 with users-affected", not "add metrics").
- jobMatches: one entry per pipeline job (use the EXACT id given). matchScore 0-100, list of keyAlignments actually present in the resume, missingKeywords the job likely expects but the resume omits, and a 1-2 sentence advice line tailored to that role.

Be specific. Reference resume content directly. Do not invent experience the candidate does not have.`;

  const parsed = await callGeminiWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallScore: { type: Type.NUMBER },
            summary: { type: Type.STRING },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            gaps: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
            jobMatches: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  jobId: { type: Type.STRING },
                  company: { type: Type.STRING },
                  jobTitle: { type: Type.STRING },
                  matchScore: { type: Type.NUMBER },
                  keyAlignments: { type: Type.ARRAY, items: { type: Type.STRING } },
                  missingKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                  advice: { type: Type.STRING },
                },
                required: ['jobId', 'matchScore', 'advice'],
              },
            },
          },
          required: ['overallScore', 'summary', 'strengths', 'gaps', 'recommendations'],
        },
      },
    });
    return JSON.parse((response.text || '').trim()) as ResumeReviewResult;
  });

  // Backfill company/title onto matches if Gemini left them blank.
  const jobById = new Map(jobs.map(j => [j.id, j]));
  parsed.jobMatches = (parsed.jobMatches || []).map(m => {
    const j = jobById.get(m.jobId);
    return {
      ...m,
      company: m.company || j?.company || '',
      jobTitle: m.jobTitle || j?.jobTitle || '',
      keyAlignments: m.keyAlignments || [],
      missingKeywords: m.missingKeywords || [],
    };
  });
  return parsed;
}

/**
 * Simple regex-based fallback parser if Gemini API is unavailable.
 */
export function fallbackParse(text: string): ParsedEmailResult {
  // The fallback runs only when Gemini is unavailable. Without an LLM we have
  // no reliable way to extract company/role, so we do NOT fabricate values.
  // We return only what we are confident about (status via keyword match) and
  // leave company/jobTitle undefined. The caller treats those as "skip"
  // rather than minting "Software Engineer at Unknown Company" ghost entries.
  const lowerText = text.toLowerCase();
  let status: JobStatus | undefined;
  if (lowerText.includes('interview') || lowerText.includes('schedule')) {
    status = 'Interviewing';
  } else if (lowerText.includes('offer') || lowerText.includes('thrilled to offer')) {
    status = 'Offered';
  } else if (lowerText.includes('decided to move forward with other') || lowerText.includes('not moving forward')) {
    status = 'Rejected';
  }

  const isJobApplication =
    !/(credit\s*score|dollar flight|deal of the day|unsubscribe|newsletter|sale ends|% off|coupon)/i.test(text);

  return {
    isJobApplication,
    status,
    date: new Date().toISOString().split('T')[0],
    summary: 'Could not parse with Gemini; review manually.',
  };
}
