import React, { useEffect, useMemo, useState } from 'react';
import { JobApplication } from '../types';
import { reviewResume, ResumeReviewResult } from '../services/geminiService';
import {
  FileText,
  Upload,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Target,
} from 'lucide-react';

interface ResumeReviewProps {
  jobs: JobApplication[];
}

const STORAGE_KEY_TEXT = 'career_sync_resume_text';
const STORAGE_KEY_NAME = 'career_sync_resume_name';
const STORAGE_KEY_REVIEW = 'career_sync_resume_review';

// Lazy-loaded extractors. PDF and DOCX libraries are ~MB-scale; only fetch
// them when the user actually uploads that file type.
async function extractPdfText(file: File): Promise<string> {
  const pdfjs: any = await import('pdfjs-dist');
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  }
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Reconstruct readable text. Recharts-style coord clustering would be
    // nicer but for resume content a flat join is close enough — the LLM
    // tolerates noisy whitespace.
    pages.push(
      content.items
        .map((it: any) => ('str' in it ? it.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
    );
  }
  return pages.join('\n\n');
}

async function extractDocxText(file: File): Promise<string> {
  const mod: any = await import('mammoth');
  const mammoth = mod.default ?? mod;
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return (result?.value || '').trim();
}

export const ResumeReview: React.FC<ResumeReviewProps> = ({ jobs }) => {
  const [resumeText, setResumeText] = useState<string>('');
  const [resumeName, setResumeName] = useState<string>('');
  const [review, setReview] = useState<ResumeReviewResult | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string>('');
  const [uploadWarning, setUploadWarning] = useState<string>('');

  useEffect(() => {
    const t = localStorage.getItem(STORAGE_KEY_TEXT);
    const n = localStorage.getItem(STORAGE_KEY_NAME);
    const r = localStorage.getItem(STORAGE_KEY_REVIEW);
    if (t) setResumeText(t);
    if (n) setResumeName(n);
    if (r) {
      try { setReview(JSON.parse(r)); } catch {}
    }
  }, []);

  const saveResume = (text: string, name: string) => {
    setResumeText(text);
    setResumeName(name);
    localStorage.setItem(STORAGE_KEY_TEXT, text);
    localStorage.setItem(STORAGE_KEY_NAME, name);
  };

  const clearResume = () => {
    setResumeText('');
    setResumeName('');
    setReview(null);
    setError('');
    setUploadWarning('');
    localStorage.removeItem(STORAGE_KEY_TEXT);
    localStorage.removeItem(STORAGE_KEY_NAME);
    localStorage.removeItem(STORAGE_KEY_REVIEW);
  };

  const handleFile = async (file: File) => {
    setUploadWarning('');
    setError('');
    const lower = file.name.toLowerCase();
    const isPdf = lower.endsWith('.pdf') || file.type === 'application/pdf';
    const isDocx = lower.endsWith('.docx')
      || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const isLegacyDoc = lower.endsWith('.doc') && !isDocx;
    const isPlainText = file.type.startsWith('text/') || /\.(txt|md|markdown|json|csv)$/.test(lower);

    if (isLegacyDoc) {
      setUploadWarning(
        `Legacy .doc files (Word 97–2003) can't be parsed in the browser. Open ${file.name} in Word or Google Docs and save as .docx or .pdf, then upload again.`
      );
      return;
    }

    if (!isPdf && !isDocx && !isPlainText) {
      setUploadWarning(
        `${file.name} isn't a supported file type. Upload .pdf, .docx, .txt, or .md — or paste the resume's text below.`
      );
      return;
    }

    setIsExtracting(true);
    try {
      let text = '';
      if (isPdf) {
        text = await extractPdfText(file);
      } else if (isDocx) {
        text = await extractDocxText(file);
      } else {
        text = await file.text();
      }
      if (!text.trim()) {
        setUploadWarning(
          `${file.name} parsed to an empty document. If it's a scanned/image PDF, run it through OCR first or paste the resume text manually.`
        );
        return;
      }
      saveResume(text, file.name);
    } catch (e: any) {
      setError(`Couldn't read ${file.name}: ${e?.message || e}`);
    } finally {
      setIsExtracting(false);
    }
  };

  const runReview = async () => {
    setError('');
    setIsReviewing(true);
    try {
      const result = await reviewResume(resumeText, jobs);
      setReview(result);
      localStorage.setItem(STORAGE_KEY_REVIEW, JSON.stringify(result));
    } catch (e: any) {
      setError(e?.message || 'Failed to run resume review.');
    } finally {
      setIsReviewing(false);
    }
  };

  const sortedMatches = useMemo(() => {
    if (!review?.jobMatches) return [];
    return [...review.jobMatches].sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
  }, [review]);

  const wordCount = useMemo(
    () => resumeText.trim().split(/\s+/).filter(Boolean).length,
    [resumeText]
  );

  const scoreColor = (s: number) =>
    s >= 80 ? 'text-emerald-400' : s >= 60 ? 'text-amber-400' : s >= 40 ? 'text-orange-400' : 'text-rose-400';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Upload / Editor Panel */}
      <div className="bg-slate-900/80 rounded-2xl border border-slate-800/80 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100">Resume</h3>
              <p className="text-xs text-slate-400">
                {resumeName
                  ? `${resumeName} • ${wordCount} words`
                  : 'Upload .pdf, .docx, or .txt — or paste your resume text below.'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <label
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-300 text-xs font-semibold transition-all ${
                isExtracting ? 'opacity-60 cursor-wait' : 'cursor-pointer'
              }`}
            >
              {isExtracting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {isExtracting ? 'Extracting…' : 'Upload File'}
              <input
                type="file"
                accept=".pdf,.docx,.doc,.txt,.md,.markdown,.json,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/*"
                className="hidden"
                disabled={isExtracting}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = '';
                }}
              />
            </label>
            {resumeText && (
              <button
                onClick={clearResume}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-800 bg-slate-950 hover:bg-rose-500/10 hover:text-rose-300 text-slate-400 text-xs font-semibold transition-all"
              >
                <Trash2 className="w-4 h-4" />
                Clear
              </button>
            )}
          </div>
        </div>

        {uploadWarning && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{uploadWarning}</span>
          </div>
        )}

        <textarea
          value={resumeText}
          onChange={(e) => saveResume(e.target.value, resumeName || 'pasted-resume.txt')}
          placeholder={`Paste your resume here. Plain text works best — section headers like\n\nEXPERIENCE\n...\n\nEDUCATION\n...\n\nare fine.`}
          rows={14}
          className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm font-mono leading-relaxed resize-y"
        />

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-slate-500">
            Reviewing against <strong className="text-slate-300">{jobs.length}</strong>{' '}
            {jobs.length === 1 ? 'job' : 'jobs'} in your pipeline.
            {jobs.length > 40 && <span className="text-amber-400 ml-1">(only the first 40 are scored individually)</span>}
          </p>
          <button
            onClick={runReview}
            disabled={isReviewing || !resumeText.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:bg-slate-700 disabled:text-slate-400 text-white text-sm font-bold transition-all shadow-neon-violet"
          >
            {isReviewing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Reviewing with Gemini...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {review ? 're-Run AI Review' : 'Run AI Review'}
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Review Results */}
      {review && (
        <>
          {/* Overall Card */}
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800/80 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Overall Resume Score</p>
                <p className={`text-5xl font-extrabold ${scoreColor(review.overallScore)}`}>
                  {review.overallScore}
                  <span className="text-2xl text-slate-500 font-bold">/100</span>
                </p>
              </div>
              <div className="max-w-2xl">
                <p className="text-sm text-slate-300 leading-relaxed">{review.summary}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <ReviewList
                title="Strengths"
                items={review.strengths}
                icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                tone="emerald"
              />
              <ReviewList
                title="Gaps"
                items={review.gaps}
                icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
                tone="amber"
              />
              <ReviewList
                title="Recommendations"
                items={review.recommendations}
                icon={<Sparkles className="w-4 h-4 text-brand-400" />}
                tone="brand"
              />
            </div>
          </div>

          {/* Per-job alignment */}
          {sortedMatches.length > 0 && (
            <div className="bg-slate-900/80 rounded-2xl border border-slate-800/80 shadow-sm p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-brand-400" />
                <h3 className="font-bold text-slate-100">Per-Job Alignment</h3>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {sortedMatches.map((m) => (
                  <div
                    key={m.jobId}
                    className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-100 truncate">{m.company || 'Unknown company'}</p>
                        <p className="text-xs text-slate-400 truncate">{m.jobTitle || '—'}</p>
                      </div>
                      <span className={`text-2xl font-extrabold ${scoreColor(m.matchScore || 0)}`}>
                        {Math.round(m.matchScore || 0)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{m.advice}</p>
                    {m.keyAlignments?.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Aligned</p>
                        <div className="flex flex-wrap gap-1.5">
                          {m.keyAlignments.map((k, i) => (
                            <span
                              key={i}
                              className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                            >
                              {k}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {m.missingKeywords?.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Missing</p>
                        <div className="flex flex-wrap gap-1.5">
                          {m.missingKeywords.map((k, i) => (
                            <span
                              key={i}
                              className="text-[11px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/20"
                            >
                              {k}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!review && !isReviewing && (
        <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-10 text-center text-slate-500">
          <Sparkles className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-300">No review yet</p>
          <p className="text-xs mt-1">
            Paste or upload your resume above, then click <strong className="text-slate-300">Run AI Review</strong> to
            score it against your current job pipeline.
          </p>
        </div>
      )}
    </div>
  );
};

interface ReviewListProps {
  title: string;
  items: string[];
  icon: React.ReactNode;
  tone: 'emerald' | 'amber' | 'brand';
}

const TONE_BORDER: Record<ReviewListProps['tone'], string> = {
  emerald: 'border-emerald-500/20',
  amber: 'border-amber-500/20',
  brand: 'border-brand-500/20',
};

const ReviewList: React.FC<ReviewListProps> = ({ title, items, icon, tone }) => (
  <div className={`bg-slate-950/60 rounded-xl border ${TONE_BORDER[tone]} p-4 space-y-2`}>
    <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-slate-300">
      {icon}
      {title}
    </div>
    {items.length > 0 ? (
      <ul className="space-y-1.5 text-xs text-slate-300 leading-relaxed list-disc list-inside marker:text-slate-600">
        {items.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
    ) : (
      <p className="text-xs text-slate-500">None identified.</p>
    )}
  </div>
);
