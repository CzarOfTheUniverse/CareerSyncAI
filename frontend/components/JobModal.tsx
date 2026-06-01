import React, { useState } from 'react';
import { JobApplication, JobStatus } from '../types';
import { generateFollowUpEmail } from '../services/geminiService';
import { 
  X, 
  Calendar, 
  MapPin, 
  DollarSign, 
  User, 
  Sparkles, 
  Copy, 
  Check, 
  Trash2,
  RefreshCw
} from 'lucide-react';

interface JobModalProps {
  job: JobApplication;
  onClose: () => void;
  onUpdateJob: (updatedJob: JobApplication) => void;
  onDeleteJob: (jobId: string) => void;
}

export const JobModal: React.FC<JobModalProps> = ({ job, onClose, onUpdateJob, onDeleteJob }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedJob, setEditedJob] = useState<JobApplication>({ ...job });
  const [aiDraft, setAiDraft] = useState<string>('');
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [copied, setCopied] = useState(false);
  const [draftTone, setDraftTone] = useState<'professional' | 'enthusiastic' | 'formal'>('professional');

  const handleSave = () => {
    onUpdateJob(editedJob);
    setIsEditing(false);
  };

  const handleGenerateDraft = async () => {
    setIsGeneratingDraft(true);
    try {
      const draft = await generateFollowUpEmail(job, draftTone);
      setAiDraft(draft);
    } catch (error) {
      console.error('Error generating draft:', error);
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(aiDraft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto animate-fade-in">
      <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
          <div>
            {isEditing ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editedJob.company}
                  onChange={(e) => setEditedJob({ ...editedJob, company: e.target.value })}
                  className="font-bold text-xl text-slate-100 border-b border-brand-500 focus:outline-none bg-transparent"
                />
                <input
                  type="text"
                  value={editedJob.jobTitle}
                  onChange={(e) => setEditedJob({ ...editedJob, jobTitle: e.target.value })}
                  className="text-lg text-slate-400 border-b border-brand-500 focus:outline-none bg-transparent"
                />
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold text-slate-100">{job.company}</h2>
                <p className="text-sm text-slate-400 mt-0.5">{job.jobTitle}</p>
              </>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Column: Job Details */}
          <div className="lg:col-span-3 space-y-6">
            {/* Status Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Application Status</label>
              <div className="flex flex-wrap gap-2">
                {(['Applied', 'Interviewing', 'Offered', 'Rejected', 'Archived'] as JobStatus[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      if (isEditing) {
                        setEditedJob({ ...editedJob, status });
                      } else {
                        onUpdateJob({ ...job, status });
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-200 hover:scale-[1.02] ${
                      (isEditing ? editedJob.status : job.status) === status
                        ? 'bg-brand-600 text-white border-brand-600 shadow-neon-violet'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-900'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* Metadata Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-slate-500" />
                <div className="flex-1">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Date Applied</p>
                  {isEditing ? (
                    <input
                      type="date"
                      value={editedJob.date}
                      onChange={(e) => setEditedJob({ ...editedJob, date: e.target.value })}
                      className="text-sm font-medium text-slate-200 bg-transparent border-b border-slate-800 focus:outline-none focus:border-brand-500 w-full"
                    />
                  ) : (
                    <p className="text-sm font-medium text-slate-200">{job.date}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-slate-500" />
                <div className="flex-1">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Location</p>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedJob.location || ''}
                      onChange={(e) => setEditedJob({ ...editedJob, location: e.target.value })}
                      placeholder="e.g. Remote, SF"
                      className="text-sm font-medium text-slate-200 bg-transparent border-b border-slate-800 focus:outline-none focus:border-brand-500 w-full"
                    />
                  ) : (
                    <p className="text-sm font-medium text-slate-200">{job.location || 'Not specified'}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-slate-500" />
                <div className="flex-1">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Salary / Comp</p>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedJob.salary || ''}
                      onChange={(e) => setEditedJob({ ...editedJob, salary: e.target.value })}
                      placeholder="e.g. $120k"
                      className="text-sm font-medium text-slate-200 bg-transparent border-b border-slate-800 focus:outline-none focus:border-brand-500 w-full"
                    />
                  ) : (
                    <p className="text-sm font-medium text-slate-200">{job.salary || 'Not specified'}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-slate-500" />
                <div className="flex-1">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Contact Person</p>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedJob.contactName || ''}
                      onChange={(e) => setEditedJob({ ...editedJob, contactName: e.target.value })}
                      placeholder="Name"
                      className="text-sm font-medium text-slate-200 bg-transparent border-b border-slate-800 focus:outline-none focus:border-brand-500 w-full"
                    />
                  ) : (
                    <p className="text-sm font-medium text-slate-200">{job.contactName || 'Not specified'}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Next Steps */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Next Steps</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedJob.nextSteps || ''}
                  onChange={(e) => setEditedJob({ ...editedJob, nextSteps: e.target.value })}
                  placeholder="e.g. Technical interview on Friday"
                  className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm"
                />
              ) : (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400 font-medium">
                  {job.nextSteps || 'No next steps scheduled.'}
                </div>
              )}
            </div>

            {/* Summary */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">AI Summary & Notes</label>
              {isEditing ? (
                <textarea
                  value={editedJob.summary}
                  onChange={(e) => setEditedJob({ ...editedJob, summary: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm"
                />
              ) : (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 text-sm text-slate-300 leading-relaxed">
                  {job.summary}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: AI Email Draft Generator */}
          <div className="lg:col-span-2 border-t lg:border-t-0 lg:border-l border-slate-800 pt-6 lg:pt-0 lg:pl-6 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1 rounded-lg bg-brand-500/10 text-brand-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-slate-100 text-sm">Gemini Email Draft Assistant</h3>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Generate a tailored follow-up or reply email based on this application's current status.
            </p>

            {/* Tone Selector */}
            <div className="mb-4">
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Tone</label>
              <div className="grid grid-cols-3 gap-2">
                {(['professional', 'enthusiastic', 'formal'] as const).map((tone) => (
                  <button
                    key={tone}
                    onClick={() => setDraftTone(tone)}
                    className={`py-1.5 rounded-lg text-xs font-medium border capitalize transition-all duration-200 hover:scale-[1.02] ${
                      draftTone === tone
                        ? 'bg-brand-500/10 text-brand-400 border-brand-500/30'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-900'
                    }`}
                  >
                    {tone}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerateDraft}
              disabled={isGeneratingDraft}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-neon-violet mb-4"
            >
              {isGeneratingDraft ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating Draft...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Draft
                </>
              )}
            </button>

            {/* Draft Output */}
            {aiDraft && (
              <div className="flex-1 flex flex-col bg-slate-950 rounded-xl border border-slate-800 p-4 overflow-hidden">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Generated Draft</span>
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 font-semibold"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto text-xs text-slate-300 whitespace-pre-wrap bg-slate-900 p-3 rounded-lg border border-slate-800/80 leading-relaxed">
                  {aiDraft}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-800 bg-slate-950/50 flex justify-between items-center">
          <button
            onClick={() => {
              if (confirm('Are you sure you want to delete this job application?')) {
                onDeleteJob(job.id);
              }
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-rose-900/50 hover:bg-rose-950/30 text-rose-400 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Trash2 className="w-4 h-4" /> Delete Job
          </button>

          <div className="flex gap-3">
            {isEditing ? (
              <>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditedJob({ ...job });
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-300 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-neon-violet"
                >
                  Save Changes
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-neon-violet"
              >
                Edit Details
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
