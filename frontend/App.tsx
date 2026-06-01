import React, { useState, useEffect } from 'react';
import { JobApplication, EmailMessage, JobStatus } from './types';
import { MOCK_EMAILS, INITIAL_JOBS } from './constants';
import { parseEmailWithGemini, parseEmailsBatch, configureGemini } from './services/geminiService';
import { fetchAppConfig, type PublicConfig } from './services/appConfig';
import { Dashboard } from './components/Dashboard';
import { KanbanBoard } from './components/KanbanBoard';
import { EmailList } from './components/EmailList';
import { AnalyticsView } from './components/AnalyticsView';
import { AIAssistant } from './components/AIAssistant';
import { JobModal } from './components/JobModal';
import { AddJobModal } from './components/AddJobModal';
import { ResumeReview } from './components/ResumeReview';
import {
  Briefcase,
  LayoutDashboard,
  Kanban,
  Mail,
  BarChart3,
  Sparkles,
  LogOut,
  RefreshCw,
  CheckCircle2,
  Settings,
  HelpCircle,
  AlertTriangle,
  Info,
  FileText
} from 'lucide-react';

import { decodeGmailBody } from './utils/gmail';

// Helper to request a fresh Google Access Token (supports silent refresh)
const requestFreshAccessToken = (clientId: string, silent = false, emailHint = ''): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      // @ts-ignore
      if (typeof google === 'undefined' || !google.accounts) {
        reject(new Error('Google Identity Services SDK not loaded yet. Please refresh and try again.'));
        return;
      }

      // @ts-ignore
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId.trim(),
        scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
        callback: (tokenResponse: any) => {
          if (tokenResponse.error) {
            reject(new Error(tokenResponse.error_description || tokenResponse.error));
            return;
          }
          if (tokenResponse.access_token) {
            resolve(tokenResponse.access_token);
          } else {
            reject(new Error('No access token returned from Google.'));
          }
        },
        error_callback: (err: any) => {
          // Without this, prompt:'none' failures (no session, consent_required, etc.)
          // never call the success callback, so the promise hangs forever.
          reject(new Error(err?.message || err?.type || 'Google authentication was cancelled or failed.'));
        },
      });

      if (silent) {
        client.requestAccessToken({ prompt: 'none', login_hint: emailHint });
      } else {
        client.requestAccessToken();
      }
    } catch (error) {
      reject(error);
    }
  });
};

export default function App() {
  // Auth & Google API State
  const [user, setUser] = useState<{ name: string; email: string; photo: string } | null>(null);
  const [authType, setAuthType] = useState<'google' | 'demo' | null>(null);
  const [googleClientId, setGoogleClientId] = useState<string>('');
  const [accessToken, setAccessToken] = useState<string>('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [authError, setAuthError] = useState<string>('');
  const [apiError, setApiError] = useState<{ message: string; details?: string } | null>(null);
  // How many days back the Gmail scan should look. 90d = ~3 months default.
  const [lookbackDays, setLookbackDays] = useState<number>(90);
  // Optional override for the Gmail "to:" filter. Defaults to the signed-in
  // account when blank. Useful when job-hunt mail is forwarded to a separate
  // address from the one logged into Google.
  const [targetRecipient, setTargetRecipient] = useState<string>('');
  // Runtime config served by the backend (/config). When it carries a
  // googleClientId, the operator configured the OAuth app at deploy time and the
  // user no longer needs to paste one.
  const [appConfig, setAppConfig] = useState<PublicConfig | null>(null);
  // The client ID to authenticate with: operator-configured value wins, with the
  // manual localStorage value as a fallback / advanced override.
  const effectiveClientId = appConfig?.googleClientId || googleClientId;
  
  // App State
  const [jobs, setJobs] = useState<JobApplication[]>(INITIAL_JOBS);
  const [emails, setEmails] = useState<EmailMessage[]>(MOCK_EMAILS);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'kanban' | 'emails' | 'analytics' | 'coach' | 'resume'>('dashboard');
  
  // Modal States
  const [selectedJob, setSelectedJob] = useState<JobApplication | null>(null);
  const [isAddJobOpen, setIsAddJobOpen] = useState(false);
  
  // Scanning/Parsing States
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [isParsingEmailId, setIsParsingEmailId] = useState<string | null>(null);

  // Load state from localStorage and validate token on mount
  useEffect(() => {
    const initAuth = async () => {
      const savedJobs = localStorage.getItem('career_sync_jobs');
      const savedEmails = localStorage.getItem('career_sync_emails');
      const savedUser = localStorage.getItem('career_sync_user');
      const savedClientId = localStorage.getItem('career_sync_client_id');
      const savedToken = localStorage.getItem('career_sync_token');
      const savedAuthType = localStorage.getItem('career_sync_auth_type') as 'google' | 'demo' | null;

      // Pull operator-supplied runtime config (OAuth client ID, model, lookback).
      const cfg = await fetchAppConfig();
      if (cfg) {
        setAppConfig(cfg);
        if (cfg.geminiModel) configureGemini({ model: cfg.geminiModel });
      }
      const clientIdForAuth = cfg?.googleClientId || savedClientId || '';

      if (savedJobs) setJobs(JSON.parse(savedJobs));
      if (savedEmails) setEmails(JSON.parse(savedEmails));
      if (savedClientId) setGoogleClientId(savedClientId);
      if (savedAuthType) setAuthType(savedAuthType);
      const savedLookback = localStorage.getItem('career_sync_lookback_days');
      if (savedLookback) {
        const n = parseInt(savedLookback, 10);
        if (!Number.isNaN(n) && n >= 7 && n <= 365) setLookbackDays(n);
      }
      const savedRecipient = localStorage.getItem('career_sync_target_recipient');
      if (savedRecipient) setTargetRecipient(savedRecipient);

      if (savedAuthType === 'google' && savedToken && savedUser) {
        const parsedUser = JSON.parse(savedUser);
        try {
          // Validate existing token
          const res = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${savedToken}`);
          if (res.ok) {
            setUser(parsedUser);
            setAccessToken(savedToken);
          } else {
            // Token expired, attempt silent refresh
            if (clientIdForAuth) {
              const freshToken = await requestFreshAccessToken(clientIdForAuth, true, parsedUser.email);
              setAccessToken(freshToken);
              localStorage.setItem('career_sync_token', freshToken);
              setUser(parsedUser);
            } else {
              handleSignOut();
            }
          }
        } catch (e) {
          // Network error or offline, fallback to saved credentials
          setUser(parsedUser);
          setAccessToken(savedToken);
        }
      } else if (savedAuthType === 'demo' && savedUser) {
        setUser(JSON.parse(savedUser));
      }
    };

    // Wait a brief moment for GIS SDK to load
    const timer = setTimeout(() => {
      initAuth();
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Save state to localStorage
  const saveJobs = (newJobs: JobApplication[]) => {
    setJobs(newJobs);
    localStorage.setItem('career_sync_jobs', JSON.stringify(newJobs));
  };

  const saveEmails = (newEmails: EmailMessage[]) => {
    setEmails(newEmails);
    localStorage.setItem('career_sync_emails', JSON.stringify(newEmails));
  };

  const saveGoogleClientId = (id: string) => {
    setGoogleClientId(id);
    localStorage.setItem('career_sync_client_id', id);
  };

  const saveLookbackDays = (days: number) => {
    setLookbackDays(days);
    localStorage.setItem('career_sync_lookback_days', String(days));
  };

  const saveTargetRecipient = (addr: string) => {
    setTargetRecipient(addr);
    if (addr.trim()) {
      localStorage.setItem('career_sync_target_recipient', addr.trim());
    } else {
      localStorage.removeItem('career_sync_target_recipient');
    }
  };

  // Real Google Sign-In Flow using Google Identity Services
  const handleGoogleSignIn = async () => {
    setAuthError('');
    setApiError(null);
    if (!effectiveClientId.trim()) {
      setAuthError('Please enter your Google Client ID first, or use Demo Mode.');
      return;
    }

    setIsSigningIn(true);

    try {
      const token = await requestFreshAccessToken(effectiveClientId);
      setAccessToken(token);
      localStorage.setItem('career_sync_token', token);
      setAuthType('google');
      localStorage.setItem('career_sync_auth_type', 'google');

      // Clear any demo seed data so the dashboard reflects only the signed-in
      // user's real Gmail data once parsing completes.
      setJobs([]);
      setEmails([]);
      localStorage.removeItem('career_sync_jobs');
      localStorage.removeItem('career_sync_emails');

      // Fetch User Profile
      const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const profile = await profileRes.json();

      const loggedInUser = {
        name: profile.name || 'Google User',
        email: profile.email || '',
        photo: profile.picture || 'https://picsum.photos/100/100'
      };

      setUser(loggedInUser);
      localStorage.setItem('career_sync_user', JSON.stringify(loggedInUser));
      setIsSigningIn(false);

      // Trigger real Gmail scan with the fresh token. Pass [] so the scan does
      // not see stale closure jobs (the demo INITIAL_JOBS or a prior session's
      // entries) and treat them as "manual" carry-over.
      triggerRealGmailScan(token, []);
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      setIsSigningIn(false);
      setAuthError(err.message || 'Failed to authenticate with Google.');
    }
  };

  // Demo Mode Sign-In (Fallback)
  const handleDemoSignIn = () => {
    setApiError(null);
    setIsSigningIn(true);
    setTimeout(() => {
      const mockUser = {
        name: 'Alex Morgan (Demo)',
        email: 'alex.morgan@gmail.com',
        photo: 'https://picsum.photos/100/100'
      };
      setUser(mockUser);
      localStorage.setItem('career_sync_user', JSON.stringify(mockUser));
      setAuthType('demo');
      localStorage.setItem('career_sync_auth_type', 'demo');
      setIsSigningIn(false);
      
      // Trigger simulated scan
      triggerSimulatedScan();
    }, 1000);
  };

  const handleSignOut = () => {
    setUser(null);
    setAccessToken('');
    setAuthType(null);
    setApiError(null);
    localStorage.removeItem('career_sync_user');
    localStorage.removeItem('career_sync_token');
    localStorage.removeItem('career_sync_auth_type');
    // Reset to initial state on sign out
    setJobs(INITIAL_JOBS);
    setEmails(MOCK_EMAILS);
    localStorage.removeItem('career_sync_jobs');
    localStorage.removeItem('career_sync_emails');
  };

  // Real Gmail Scan Flow.
  // baselineJobs: the list of jobs to start with before re-parsing emails.
  // Pass [] from fresh-sign-in flows; default (omit) to keep currently-loaded
  // jobs and let the scan strip out email-derived ones.
  const triggerRealGmailScan = async (token: string, baselineJobs?: JobApplication[]) => {
    setIsScanning(true);
    setScanProgress(10);
    setApiError(null);

    try {
      // Recipient filter for the Gmail "to:" query. Defaults to the signed-in
      // account, but the user can override it (Settings input) when job-hunt
      // mail is forwarded to a different address.
      const recipient = (targetRecipient || '').trim() || user?.email || '';
      // Restrict to a recent window so we are not spending Gemini calls on
      // years-old archive emails. lookbackDays is user-controlled.
      const afterDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
      const afterStr = `${afterDate.getFullYear()}/${String(afterDate.getMonth() + 1).padStart(2, '0')}/${String(afterDate.getDate()).padStart(2, '0')}`;
      // Query for job-related emails inside the chosen time window. The
      // keyword list searches the WHOLE email (not just the subject) and
      // includes common rejection phrasing — many rejection emails have
      // subjects like "Update on your application" or "Thank you for your
      // interest" with no literal "reject" anywhere, so a subject-only filter
      // would miss them entirely. The `to:` clause is omitted when no
      // recipient is known so we don't silently drop all matches.
      const recipientClause = recipient ? ` to:${recipient}` : '';
      const query = `(application OR applying OR interview OR offer OR reject OR rejection OR "not moving forward" OR "moving forward" OR unfortunately OR "thank you for your interest" OR "your application" OR "your candidacy" OR "next steps" OR hiring OR recruiter OR decided)${recipientClause} after:${afterStr}`;
      const listRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=100`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!listRes.ok) {
        const errData = await listRes.json().catch(() => ({}));
        throw new Error(errData?.error?.message || 'Failed to fetch message list from Gmail API. Make sure the Gmail API is enabled in your Google Cloud Console.');
      }
      
      const listData = await listRes.json();
      
      if (!listData.messages || listData.messages.length === 0) {
        setScanProgress(100);
        setTimeout(() => setIsScanning(false), 500);
        alert('No job-related emails found in your Gmail inbox.');
        return;
      }

      const totalMessages = listData.messages.length;

      // Fetch every message body in parallel with a bounded concurrency window
      // so we don't fire 100 simultaneous requests but also don't wait
      // sequentially. ~10 in flight gives ~10x throughput over the old loop
      // while staying well under Gmail's per-user quota.
      const FETCH_CONCURRENCY = 10;
      const fetchedEmails: EmailMessage[] = new Array(totalMessages);
      let fetchedCount = 0;
      let nextMsgIdx = 0;
      const worker = async () => {
        while (true) {
          const idx = nextMsgIdx++;
          if (idx >= totalMessages) return;
          const msgMeta = listData.messages[idx];
          try {
            const msgRes = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgMeta.id}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (msgRes.ok) {
              const msgData = await msgRes.json();
              const headers = msgData.payload.headers;
              const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || 'No Subject';
              const sender = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || 'Unknown Sender';
              const rawDate = headers.find((h: any) => h.name.toLowerCase() === 'date')?.value || '';
              let formattedDate = new Date().toISOString().split('T')[0];
              try {
                if (rawDate) formattedDate = new Date(rawDate).toISOString().split('T')[0];
              } catch (e) {}
              const body = decodeGmailBody(msgData.payload) || msgData.snippet || '';
              fetchedEmails[idx] = { id: msgData.id, threadId: msgData.threadId, sender, subject, date: formattedDate, body, parsed: false };
            }
          } catch (e) {
            console.warn(`Failed to fetch message ${msgMeta.id}:`, e);
          }
          fetchedCount++;
          setScanProgress(Math.min(50, Math.round(10 + (fetchedCount / totalMessages) * 40)));
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(FETCH_CONCURRENCY, totalMessages) }, () => worker())
      );
      // Compact out any holes from failed fetches.
      const fetchedEmailsCompact = fetchedEmails.filter(Boolean);
      saveEmails(fetchedEmailsCompact);
      setScanProgress(50);

      // Preserve manually-added jobs (those without an emailSourceId), but drop
      // anything previously derived from email so re-syncs rebuild with current
      // dedup logic instead of stacking duplicate cards across runs.
      const baseline = baselineJobs ?? jobs;
      const manuallyAddedJobs = baseline.filter(j => !j.emailSourceId);
      const accumulatedJobs: JobApplication[] = [...manuallyAddedJobs];
      const parsedEmails: EmailMessage[] = [...fetchedEmailsCompact];

      // Strip requisition IDs / job codes / trailing reference numbers from
      // titles before normalizing. "Advanced Environment Technical Artist —
      // R000101539" becomes "Advanced Environment Technical Artist" so dedup
      // matches the same role posted without the req ID.
      const cleanJobTitle = (t: string) =>
        t
          .replace(/\s*[\-—–|(\[]\s*(R|JR|REQ|Req|JOB|Ref|#)[\s\-:]*[A-Z0-9]*\d{2,}[\s)\]]*$/i, '')
          .replace(/\s*\(\s*(req|requisition|job|ref)[\s\-:#]*\d+\s*\)/i, '')
          .replace(/\s*#?\d{4,}\s*$/, '')
          .trim();

      // Title signature: tokenise → expand common abbreviations → drop rank /
      // seniority words → unique, sorted, joined. Two titles that differ only
      // in rank ("Senior Tech Artist" vs "Technical Artist") or abbreviation
      // collapse to the same signature, but titles with project qualifiers
      // ("- VALORANT", "- Animation", "Tools & Pipeline") stay distinct.
      const RANK_TOKENS = new Set([
        'sr', 'senior', 'jr', 'junior', 'principal', 'lead', 'staff',
        'associate', 'entry', 'i', 'ii', 'iii', 'iv', 'v',
      ]);
      const ABBREV_MAP: Record<string, string> = {
        tech: 'technical',
        sw: 'software',
        eng: 'engineer',
        engr: 'engineer',
        mgr: 'manager',
        dev: 'developer',
      };
      const titleTokens = (jobTitle: string): Set<string> => {
        const cleaned = cleanJobTitle(jobTitle).toLowerCase();
        const tokens = cleaned
          .split(/[^a-z0-9]+/)
          .filter(Boolean)
          .map(t => ABBREV_MAP[t] || t)
          .filter(t => !RANK_TOKENS.has(t));
        return new Set(tokens);
      };
      const titleSignature = (jobTitle: string) =>
        Array.from(titleTokens(jobTitle)).sort().join('');
      const companyKey = (company: string) =>
        company.toLowerCase().replace(/[^a-z0-9]+/g, '');
      const dedupKeyFor = (company: string, jobTitle: string) =>
        `${companyKey(company)}::${titleSignature(jobTitle)}`;

      // Subset match: true when one title's significant tokens are wholly
      // contained in the other's. "Principal Technical Artist" ⊂ "Principal
      // Technical Artist, Games R&D - Tech Lab" -> same role. Requires the
      // smaller set to have at least 2 tokens to avoid trivial matches like
      // a bare "Engineer".
      const isSubsetMatch = (a: Set<string>, b: Set<string>): boolean => {
        const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
        if (smaller.size < 2) return false;
        for (const tok of smaller) if (!larger.has(tok)) return false;
        return true;
      };

      const seenJobKeys = new Set<string>(
        manuallyAddedJobs.map(j => dedupKeyFor(j.company, j.jobTitle))
      );
      // Thread-based dedup: any two emails sharing a Gmail threadId are about
      // the same role (e.g. an interview-invite calendar reply and an offer
      // discussion that follow each other inside one conversation collapse to
      // one job card, even if Gemini labels them with slightly different
      // titles).
      const jobByThreadId = new Map<string, JobApplication>();
      const statusRank: Record<string, number> = {
        Applied: 1, Interviewing: 2, Offered: 3, Rejected: 3, Archived: 0,
      };
      // Wipe the current jobs list immediately so the UI doesn't show stale
      // duplicates while the parse loop runs.
      saveJobs([...manuallyAddedJobs]);

      // Batch the emails so each Gemini call handles ~20 at once. Run batches
      // in parallel — this turns ~50 sequential 3s calls into 3 parallel ~6s
      // calls, mirroring what asking Gemini directly does.
      const BATCH_SIZE = 20;
      const batches: EmailMessage[][] = [];
      for (let i = 0; i < parsedEmails.length; i += BATCH_SIZE) {
        batches.push(parsedEmails.slice(i, i + BATCH_SIZE));
      }
      const emailById = new Map(parsedEmails.map(e => [e.id, e]));
      const indexById = new Map(parsedEmails.map((e, idx) => [e.id, idx]));

      let batchesDone = 0;
      await Promise.all(batches.map(async (batch) => {
        const results = await parseEmailsBatch(
          batch.map(e => ({ id: e.id, sender: e.sender, subject: e.subject, date: e.date, body: e.body }))
        );
        // Merge each batch's results into shared state. Sequential merge
        // inside this callback is fine — the heavy lifting (the Gemini call)
        // already happened in parallel.
        for (const parsed of results) {
          const email = emailById.get(parsed.id);
          if (!email) continue;
          const idx = indexById.get(parsed.id)!;

          if (parsed.isJobApplication === false) {
            parsedEmails[idx] = { ...email, parsed: true };
            continue;
          }
          const company = parsed.company?.trim();
          const jobTitle = parsed.jobTitle ? cleanJobTitle(parsed.jobTitle) : undefined;
          if (!company || !jobTitle) {
            console.warn(`Skipping email ${email.id}: Gemini did not return company/jobTitle.`);
            parsedEmails[idx] = { ...email, parsed: true };
            continue;
          }
          const newStatus = (parsed.status as JobStatus) || 'Applied';

          // Helper: merge this parse into an existing job. Status upgrades
          // (Applied -> Interviewing -> Offered/Rejected) replace company /
          // title with the more authoritative later-stage values, and any
          // non-empty fields fill gaps on the existing record.
          const mergeInto = (existing: JobApplication) => {
            const rankNew = statusRank[newStatus] ?? 0;
            const rankOld = statusRank[existing.status] ?? 0;
            if (rankNew > rankOld) {
              existing.status = newStatus;
              // Later-stage email tends to use the canonical company/title.
              existing.company = company;
              existing.jobTitle = jobTitle;
              existing.date = parsed.date || existing.date;
            }
            existing.location ??= parsed.location;
            existing.salary ??= parsed.salary;
            existing.contactName ??= parsed.contactName;
            existing.contactEmail ??= parsed.contactEmail || email.sender;
            existing.nextSteps ??= parsed.nextSteps;
            parsedEmails[idx] = { ...email, parsed: true, jobId: existing.id };
          };

          // 1. Thread match: same Gmail conversation = same role.
          if (email.threadId && jobByThreadId.has(email.threadId)) {
            mergeInto(jobByThreadId.get(email.threadId)!);
            continue;
          }

          // 2. Company+title match across threads (catches roles where the
          // conversation got split into separate threads).
          const dedupKey = dedupKeyFor(company, jobTitle);
          if (seenJobKeys.has(dedupKey)) {
            const existing = accumulatedJobs.find(j => dedupKeyFor(j.company, j.jobTitle) === dedupKey);
            if (existing) {
              mergeInto(existing);
              if (email.threadId) jobByThreadId.set(email.threadId, existing);
            }
            continue;
          }

          // 3. Subset-title match: when Gemini abbreviates a role title on a
          // follow-up email ("Principal role" instead of "Principal Technical
          // Artist, Games R&D - Tech Lab"), check whether the new title's
          // tokens are wholly contained in (or contain) a single existing
          // entry at the same company. If exactly one such candidate, merge.
          const ck = companyKey(company);
          const newTokens = titleTokens(jobTitle);
          const subsetMatches = accumulatedJobs.filter(j =>
            companyKey(j.company) === ck && isSubsetMatch(titleTokens(j.jobTitle), newTokens)
          );
          if (subsetMatches.length === 1) {
            mergeInto(subsetMatches[0]);
            if (email.threadId) jobByThreadId.set(email.threadId, subsetMatches[0]);
            continue;
          }

          // 4. Terminal-status fallback: rejection / offer emails frequently
          // arrive as fresh threads and may abbreviate or restate the role
          // title differently. If this is a terminal state (Rejected/Offered)
          // and the company has exactly one existing job, route the status
          // update to that job instead of creating a new card.
          const isTerminal = newStatus === 'Rejected' || newStatus === 'Offered';
          if (isTerminal) {
            const sameCompany = accumulatedJobs.filter(j => companyKey(j.company) === ck);
            if (sameCompany.length === 1) {
              mergeInto(sameCompany[0]);
              if (email.threadId) jobByThreadId.set(email.threadId, sameCompany[0]);
              continue;
            }
          }

          const newJob: JobApplication = {
            id: `job-${Date.now()}-${idx}`,
            company,
            jobTitle,
            status: newStatus,
            date: parsed.date || email.date,
            location: parsed.location,
            salary: parsed.salary,
            contactName: parsed.contactName,
            contactEmail: parsed.contactEmail || email.sender,
            nextSteps: parsed.nextSteps,
            summary: parsed.summary || 'Parsed automatically from Gmail.',
            emailSourceId: email.id,
          };
          seenJobKeys.add(dedupKey);
          if (email.threadId) jobByThreadId.set(email.threadId, newJob);
          accumulatedJobs.unshift(newJob);
          parsedEmails[idx] = { ...email, parsed: true, jobId: newJob.id };
        }
        batchesDone++;
        setScanProgress(Math.min(99, 50 + Math.round((batchesDone / batches.length) * 49)));
        saveJobs([...accumulatedJobs]);
        saveEmails([...parsedEmails]);
      }));

      setIsParsingEmailId(null);
      setScanProgress(100);
      setTimeout(() => setIsScanning(false), 300);

    } catch (error: any) {
      console.error('Error scanning real Gmail:', error);
      setIsScanning(false);
      setApiError({
        message: error.message || 'Failed to connect to Gmail API.',
        details: 'This usually happens if the Gmail API is not enabled in your Google Cloud Console, or if your OAuth Client ID is configured incorrectly.'
      });
    }
  };

  // Simulated Gmail Scan Flow (Fallback)
  const triggerSimulatedScan = () => {
    setIsScanning(true);
    setScanProgress(0);
    setApiError(null);
    
    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsScanning(false);
            autoParseFirstEmail();
          }, 500);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const autoParseFirstEmail = async () => {
    const unparsed = emails.find(e => !e.parsed);
    if (unparsed) {
      await handleParseEmail(unparsed.id);
    }
  };

  // Trigger scan based on auth type, automatically requesting a fresh token if Google Mode
  const handleScanClick = async () => {
    if (authType === 'google') {
      setIsScanning(true);
      setScanProgress(5);
      try {
        // Try silent refresh first so the account chooser does not pop up on
        // every Sync click. Only fall back to interactive consent if silent
        // fails (no active Google session, consent revoked, etc.).
        let freshToken: string;
        try {
          freshToken = await requestFreshAccessToken(effectiveClientId, true, user?.email || '');
        } catch (silentErr) {
          console.warn('Silent token refresh failed, falling back to interactive:', silentErr);
          freshToken = await requestFreshAccessToken(effectiveClientId, false, user?.email || '');
        }
        setAccessToken(freshToken);
        localStorage.setItem('career_sync_token', freshToken);
        triggerRealGmailScan(freshToken);
      } catch (error: any) {
        console.error('Failed to refresh token for scan:', error);
        setIsScanning(false);
        setApiError({
          message: error.message || 'Failed to refresh Google Access Token.',
          details: 'Please try signing in again to re-authorize Gmail access.'
        });
      }
    } else {
      triggerSimulatedScan();
    }
  };

  // Parse Email with Gemini
  const handleParseEmail = async (emailId: string) => {
    setIsParsingEmailId(emailId);
    const email = emails.find(e => e.id === emailId);
    if (!email) return;

    try {
      const parsedDetails = await parseEmailWithGemini(email.body);
      
      const newJob: JobApplication = {
        id: `job-${Date.now()}`,
        company: parsedDetails.company || 'Unknown Company',
        jobTitle: parsedDetails.jobTitle || 'Software Engineer',
        status: (parsedDetails.status as JobStatus) || 'Applied',
        date: parsedDetails.date || email.date,
        location: parsedDetails.location || undefined,
        salary: parsedDetails.salary || undefined,
        contactName: parsedDetails.contactName || undefined,
        contactEmail: parsedDetails.contactEmail || email.sender,
        nextSteps: parsedDetails.nextSteps || undefined,
        summary: parsedDetails.summary || 'Parsed automatically from Gmail.',
        emailSourceId: email.id
      };

      // Update jobs list
      const updatedJobs = [newJob, ...jobs];
      saveJobs(updatedJobs);

      // Mark email as parsed
      const updatedEmails = emails.map(e => 
        e.id === emailId ? { ...e, parsed: true, jobId: newJob.id } : e
      );
      saveEmails(updatedEmails);

    } catch (error) {
      console.error('Failed to parse email:', error);
    } finally {
      setIsParsingEmailId(null);
    }
  };

  // Job CRUD Operations
  const handleAddJob = (newJob: JobApplication) => {
    const updatedJobs = [newJob, ...jobs];
    saveJobs(updatedJobs);
    setIsAddJobOpen(false);
  };

  const handleUpdateJob = (updatedJob: JobApplication) => {
    const updatedJobs = jobs.map(j => j.id === updatedJob.id ? updatedJob : j);
    saveJobs(updatedJobs);
    if (selectedJob?.id === updatedJob.id) {
      setSelectedJob(updatedJob);
    }
  };

  const handleUpdateJobStatus = (jobId: string, newStatus: JobStatus) => {
    const updatedJobs = jobs.map(j => j.id === jobId ? { ...j, status: newStatus } : j);
    saveJobs(updatedJobs);
  };

  const handleDeleteJob = (jobId: string) => {
    const updatedJobs = jobs.filter(j => j.id !== jobId);
    saveJobs(updatedJobs);
    
    // If the deleted job was parsed from an email, mark the email as unparsed again
    const updatedEmails = emails.map(e => 
      e.jobId === jobId ? { ...e, parsed: false, jobId: undefined } : e
    );
    saveEmails(updatedEmails);
    
    setSelectedJob(null);
  };

  // Render Landing Page if not signed in
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col justify-between bg-[#080c14] text-white relative overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-600/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl"></div>

        {/* Header */}
        <header className="container mx-auto px-6 py-6 flex justify-between items-center relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">
              <Briefcase className="w-6 h-6" />
            </div>
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              CareerSync AI
            </span>
          </div>
        </header>

        {/* Hero Section */}
        <main className="container mx-auto px-6 py-12 flex flex-col lg:flex-row items-center gap-12 relative z-10 my-auto">
          <div className="flex-1 space-y-8 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" /> Powered by Gemini 2.5 Flash
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
              Your Job Search,<br />
              <span className="bg-gradient-to-r from-brand-400 to-violet-400 bg-clip-text text-transparent">
                Automatically Organized.
              </span>
            </h1>
            <p className="text-slate-400 text-base sm:text-lg max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Connect your real Gmail account to automatically scan, extract, and categorize job applications, interview invites, offers, and rejections. Track everything in a beautiful dashboard.
            </p>

            {/* Google API Configuration Panel */}
            <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-800 max-w-md mx-auto lg:mx-0 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Settings className="w-4 h-4 text-brand-400" /> Google API Configuration
                </span>
                <button 
                  onClick={() => setShowSetupGuide(!showSetupGuide)}
                  className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"
                >
                  <HelpCircle className="w-3.5 h-3.5" /> Setup Guide
                </button>
              </div>

              {showSetupGuide && (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-2 leading-relaxed animate-fade-in">
                  <p className="font-bold text-slate-200">How to get a Google Client ID:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Go to the <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" className="text-brand-400 underline">Google Cloud Console</a>.</li>
                    <li>Create a project and enable the <strong className="text-slate-200">Gmail API</strong>.</li>
                    <li>Configure the OAuth Consent Screen (External, add your email as test user).</li>
                    <li>Go to Credentials &rarr; Create Credentials &rarr; OAuth client ID.</li>
                    <li>Select <strong className="text-slate-200">Web application</strong>.</li>
                    <li>Add this app's current URL to <strong className="text-slate-200">Authorized JavaScript origins</strong>.</li>
                    <li>Copy the Client ID and paste it below!</li>
                  </ol>
                </div>
              )}

              {!appConfig?.googleClientId && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Google OAuth Client ID</label>
                  <input
                    type="text"
                    value={googleClientId}
                    onChange={(e) => saveGoogleClientId(e.target.value)}
                    placeholder="123456789-abc123xyz.apps.googleusercontent.com"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500 text-xs"
                  />
                </div>
              )}

              {authError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={handleGoogleSignIn}
                  disabled={isSigningIn}
                  className="flex-1 flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm transition-all shadow-neon-violet disabled:opacity-70"
                >
                  {isSigningIn ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-3.3 3.28-8.16 3.28-13.09z" fill="currentColor"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="currentColor" opacity="0.8"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="currentColor" opacity="0.7"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="currentColor" opacity="0.9"/>
                      </svg>
                      Sign in with Google
                    </>
                  )}
                </button>

                <button
                  onClick={handleDemoSignIn}
                  disabled={isSigningIn}
                  className="px-5 py-3 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 font-semibold text-sm transition-all"
                >
                  Demo Mode
                </button>
              </div>
            </div>

            {/* Feature Highlights */}
            <div className="grid grid-cols-3 gap-4 pt-6 max-w-md mx-auto lg:mx-0 border-t border-slate-800">
              <div>
                <p className="text-2xl font-bold text-white">100%</p>
                <p className="text-xs text-slate-500 mt-1">Automated Tracking</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">Gemini</p>
                <p className="text-xs text-slate-500 mt-1">AI Email Parsing</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">CSV</p>
                <p className="text-xs text-slate-500 mt-1">Instant Export</p>
              </div>
            </div>
          </div>

          {/* Hero Image / Mockup */}
          <div className="flex-1 w-full max-w-lg lg:max-w-none relative">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-3xl p-6 shadow-2xl backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-slate-700/50 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                </div>
                <span className="text-xs text-slate-500 font-mono">careersync-dashboard.ai</span>
              </div>
              
              {/* Mock Dashboard UI */}
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700/30">
                    <span className="text-[10px] text-slate-500 block">Total Jobs</span>
                    <span className="text-lg font-bold text-white">12</span>
                  </div>
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700/30">
                    <span className="text-[10px] text-slate-500 block">Interviews</span>
                    <span className="text-lg font-bold text-amber-400">3</span>
                  </div>
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700/30">
                    <span className="text-[10px] text-slate-500 block">Offers</span>
                    <span className="text-lg font-bold text-emerald-400">1</span>
                  </div>
                </div>

                <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-700/30 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-white">Recent AI Sync</span>
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Synced 2m ago
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-2 rounded bg-slate-800/40 text-xs">
                      <span className="font-semibold text-white">Stripe</span>
                      <span className="text-slate-400">Software Engineer</span>
                      <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">Applied</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded bg-slate-800/40 text-xs">
                      <span className="font-semibold text-white">Google</span>
                      <span className="text-slate-400">UX Designer</span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">Interviewing</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="container mx-auto px-6 py-6 text-center text-slate-600 text-xs border-t border-slate-800/50 relative z-10">
          &copy; 2025 CareerSync AI. All rights reserved. Built with Gemini 2.5 Flash.
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#080c14] text-slate-100">
      {/* Top Navigation Bar */}
      <header className="bg-slate-900/80 border-b border-slate-800/80 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-600 text-white shadow-md shadow-brand-600/20">
              <Briefcase className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-lg tracking-tight text-slate-100">
              CareerSync AI
            </span>
            {authType === 'demo' && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                Demo Mode
              </span>
            )}
          </div>

          {/* User Profile & Actions */}
          <div className="flex items-center gap-4">
            {authType === 'google' && (
              <div className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-800 bg-slate-950">
                <label htmlFor="recipient-input" className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold whitespace-nowrap">
                  Inbox to:
                </label>
                <input
                  id="recipient-input"
                  type="email"
                  value={targetRecipient}
                  onChange={(e) => saveTargetRecipient(e.target.value)}
                  placeholder={user?.email || 'you@example.com'}
                  disabled={isScanning}
                  className="w-52 px-2 py-1 rounded-md bg-transparent border border-slate-800 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-500 text-xs"
                  title="Override the Gmail 'to:' filter (defaults to your signed-in address). Useful when job-hunt mail is forwarded to a different address."
                />
              </div>
            )}

            {/* Lookback Range Slider */}
            <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-800 bg-slate-950">
              <label htmlFor="lookback-slider" className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold whitespace-nowrap">
                Look back
              </label>
              <input
                id="lookback-slider"
                type="range"
                min={7}
                max={365}
                step={1}
                value={lookbackDays}
                onChange={(e) => saveLookbackDays(Number(e.target.value))}
                disabled={isScanning}
                className="w-32 accent-brand-500"
                title={`Scan emails from the last ${lookbackDays} days`}
              />
              <span className="text-xs font-bold text-slate-200 tabular-nums whitespace-nowrap min-w-[3.25rem] text-right">
                {lookbackDays}d
                <span className="text-slate-500 font-normal"> (~{Math.round(lookbackDays / 30)}mo)</span>
              </span>
            </div>

            {/* Sync Button */}
            <button
              onClick={handleScanClick}
              disabled={isScanning}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-300 text-xs font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70"
            >
              <RefreshCw className={`w-4 h-4 text-brand-400 ${isScanning ? 'animate-spin' : ''}`} />
              {isScanning
                ? `Scanning (${scanProgress}%)`
                : authType === 'google' ? 'Sync Gmail' : 'Run Demo Scan'}
            </button>

            {/* User Dropdown/Profile */}
            <div className="flex items-center gap-3 pl-4 border-l border-slate-800">
              <img
                src={user.photo}
                alt={user.name}
                className="w-9 h-9 rounded-full border border-slate-800"
              />
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-slate-200">{user.name}</p>
                <p className="text-[10px] text-slate-500">{user.email}</p>
              </div>
              <button
                onClick={handleSignOut}
                title="Sign Out"
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-rose-400 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 flex flex-col lg:flex-row gap-6 w-full">
        {/* Sidebar Navigation */}
        <aside className="lg:w-64 flex-shrink-0">
          <nav className="space-y-1 bg-slate-900/80 p-3 rounded-2xl border border-slate-800/80 shadow-sm">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.02] ${
                activeTab === 'dashboard'
                  ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20 shadow-neon-violet'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <LayoutDashboard className="w-5 h-5" />
              Dashboard
            </button>

            <button
              onClick={() => setActiveTab('kanban')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.02] ${
                activeTab === 'kanban'
                  ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20 shadow-neon-violet'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <Kanban className="w-5 h-5" />
              Kanban Board
            </button>

            <button
              onClick={() => setActiveTab('emails')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.02] relative ${
                activeTab === 'emails'
                  ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20 shadow-neon-violet'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <Mail className="w-5 h-5" />
              Gmail Inbox
              {emails.filter(e => !e.parsed).length > 0 && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 bg-brand-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {emails.filter(e => !e.parsed).length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.02] ${
                activeTab === 'analytics'
                  ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20 shadow-neon-violet'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-5 h-5" />
              Analytics
            </button>

            <button
              onClick={() => setActiveTab('resume')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.02] ${
                activeTab === 'resume'
                  ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20 shadow-neon-violet'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <FileText className="w-5 h-5" />
              Resume Review
            </button>

            <button
              onClick={() => setActiveTab('coach')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.02] ${
                activeTab === 'coach'
                  ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20 shadow-neon-violet'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-5 h-5 text-brand-400" />
              AI Career Coach
            </button>
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0">
          {/* Scanning Progress Bar */}
          {isScanning && (
            <div className="mb-6 bg-slate-900/80 p-4 rounded-2xl border border-slate-800/80 shadow-sm space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="w-4 h-4 text-brand-400 animate-spin" />
                  {authType === 'google'
                    ? 'Scanning your Gmail inbox for job-related emails...'
                    : 'Loading demo inbox and parsing sample emails...'}
                </span>
                <span>{scanProgress}%</span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-brand-600 h-full transition-all duration-300"
                  style={{ width: `${scanProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* API Error Troubleshooting Panel */}
          {apiError && (
            <div className="mb-6 bg-slate-900/90 p-6 rounded-2xl border border-rose-900/50 shadow-neon-pink space-y-4 animate-fade-in">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-rose-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-slate-100 text-base">Gmail API Connection Issue</h3>
                  <p className="text-sm text-rose-300 mt-1">{apiError.message}</p>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">{apiError.details}</p>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-brand-400" /> Actionable Troubleshooting Checklist:
                </h4>
                <ul className="list-disc list-inside text-xs text-slate-400 space-y-1.5 leading-relaxed">
                  <li>
                    Did you enable the <strong className="text-slate-200">Gmail API</strong> in your Google Cloud Console? Go to <strong className="text-slate-200">APIs & Services &rarr; Library</strong>, search for "Gmail API", and click <strong className="text-slate-200">Enable</strong>.
                  </li>
                  <li>
                    Is your OAuth Consent Screen configured as <strong className="text-slate-200">Testing</strong>? If so, you must add your email address (<span className="text-brand-400">{user.email}</span>) to the <strong className="text-slate-200">Test Users</strong> list in the Google Cloud Console.
                  </li>
                  <li>
                    Did you add this app's exact origin URL to the <strong className="text-slate-200">Authorized JavaScript origins</strong> in your OAuth Client ID settings?
                  </li>
                </ul>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  onClick={handleScanClick}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition-all duration-200 hover:scale-[1.02]"
                >
                  <RefreshCw className="w-4 h-4" /> Retry Gmail Sync
                </button>
                <button
                  onClick={() => {
                    setApiError(null);
                    triggerSimulatedScan();
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold transition-all duration-200 hover:scale-[1.02]"
                >
                  <Sparkles className="w-4 h-4 text-brand-400" /> Load Demo Emails Instead
                </button>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-400 text-xs font-semibold transition-all duration-200 hover:scale-[1.02]"
                >
                  <LogOut className="w-4 h-4" /> Sign Out / Reconnect
                </button>
              </div>
            </div>
          )}

          {/* Tab Views */}
          {activeTab === 'dashboard' && (
            <Dashboard 
              jobs={jobs} 
              onSelectJob={setSelectedJob} 
              onAddJobClick={() => setIsAddJobOpen(true)} 
            />
          )}

          {activeTab === 'kanban' && (
            <KanbanBoard 
              jobs={jobs} 
              onSelectJob={setSelectedJob} 
              onUpdateStatus={handleUpdateJobStatus} 
            />
          )}

          {activeTab === 'emails' && (
            <EmailList
              emails={emails}
              onParseEmail={handleParseEmail}
              isParsing={isParsingEmailId}
              authType={authType}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsView jobs={jobs} />
          )}

          {activeTab === 'resume' && (
            <ResumeReview jobs={jobs} />
          )}

          {activeTab === 'coach' && (
            <AIAssistant jobs={jobs} />
          )}
        </main>
      </div>

      {/* Job Detail Modal */}
      {selectedJob && (
        <JobModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onUpdateJob={handleUpdateJob}
          onDeleteJob={handleDeleteJob}
        />
      )}

      {/* Add Job Modal */}
      {isAddJobOpen && (
        <AddJobModal
          onClose={() => setIsAddJobOpen(false)}
          onAddJob={handleAddJob}
        />
      )}
    </div>
  );
}
