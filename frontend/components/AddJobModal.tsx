import React, { useState } from 'react';
import { JobApplication, JobStatus } from '../types';
import { parseEmailWithGemini } from '../services/geminiService';
import { X, Sparkles, RefreshCw } from 'lucide-react';

interface AddJobModalProps {
  onClose: () => void;
  onAddJob: (job: JobApplication) => void;
}

export const AddJobModal: React.FC<AddJobModalProps> = ({ onClose, onAddJob }) => {
  const [activeTab, setActiveTab] = useState<'manual' | 'ai-parse'>('manual');
  const [isParsing, setIsParsing] = useState(false);
  
  // Manual Form State
  const [company, setCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [status, setStatus] = useState<JobStatus>('Applied');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [location, setLocation] = useState('');
  const [salary, setSalary] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [summary, setSummary] = useState('');

  // AI Parse State
  const [emailText, setEmailText] = useState('');

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !jobTitle) return;

    const newJob: JobApplication = {
      id: `job-${Date.now()}`,
      company,
      jobTitle,
      status,
      date,
      location: location || undefined,
      salary: salary || undefined,
      contactName: contactName || undefined,
      contactEmail: contactEmail || undefined,
      nextSteps: nextSteps || undefined,
      summary: summary || `Manually added application for ${jobTitle} at ${company}.`
    };

    onAddJob(newJob);
  };

  const handleAIParseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailText.trim() || isParsing) return;

    setIsParsing(true);
    try {
      const parsedDetails = await parseEmailWithGemini(emailText);
      
      const newJob: JobApplication = {
        id: `job-${Date.now()}`,
        company: parsedDetails.company || 'Unknown Company',
        jobTitle: parsedDetails.jobTitle || 'Software Engineer',
        status: (parsedDetails.status as JobStatus) || 'Applied',
        date: parsedDetails.date || new Date().toISOString().split('T')[0],
        location: parsedDetails.location || undefined,
        salary: parsedDetails.salary || undefined,
        contactName: parsedDetails.contactName || undefined,
        contactEmail: parsedDetails.contactEmail || undefined,
        nextSteps: parsedDetails.nextSteps || undefined,
        summary: parsedDetails.summary || 'Parsed via Gemini AI.'
      };

      onAddJob(newJob);
    } catch (error) {
      console.error('Error parsing custom email:', error);
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto animate-fade-in">
      <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
          <div>
            <h2 className="text-xl font-bold text-slate-100">Add Job Application</h2>
            <p className="text-sm text-slate-400 mt-0.5">Track a new opportunity manually or parse an email with AI</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/30">
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-all duration-200 ${
              activeTab === 'manual'
                ? 'border-brand-500 text-brand-400 bg-slate-900/50'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            Manual Entry
          </button>
          <button
            onClick={() => setActiveTab('ai-parse')}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-all duration-200 flex items-center justify-center gap-1.5 ${
              activeTab === 'ai-parse'
                ? 'border-brand-500 text-brand-400 bg-slate-900/50'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            <Sparkles className="w-4 h-4" /> Parse Email with Gemini
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'manual' ? (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Company *</label>
                  <input
                    type="text"
                    required
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="e.g. Stripe"
                    className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Job Title *</label>
                  <input
                    type="text"
                    required
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="e.g. Frontend Engineer"
                    className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as JobStatus)}
                    className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm appearance-none cursor-pointer transition-all"
                  >
                    <option value="Applied">Applied</option>
                    <option value="Interviewing">Interviewing</option>
                    <option value="Offered">Offered</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Date Applied</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Location</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Remote, New York"
                    className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Salary / Compensation</label>
                  <input
                    type="text"
                    value={salary}
                    onChange={(e) => setSalary(e.target.value)}
                    placeholder="e.g. $130,000"
                    className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Contact Name</label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="e.g. Jane Doe"
                    className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Contact Email</label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="e.g. jane@company.com"
                    className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Next Steps</label>
                <input
                  type="text"
                  value={nextSteps}
                  onChange={(e) => setNextSteps(e.target.value)}
                  placeholder="e.g. Technical interview on Friday"
                  className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Summary / Notes</label>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={3}
                  placeholder="Add any additional details or notes here..."
                  className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm transition-all"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-300 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-neon-violet"
                >
                  Add Application
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleAIParseSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Paste Job Email Content
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  Paste the full text of any job application confirmation, interview invite, offer, or rejection email. Gemini AI will automatically extract the company, job title, status, contact info, and next steps.
                </p>
                <textarea
                  required
                  value={emailText}
                  onChange={(e) => setEmailText(e.target.value)}
                  rows={10}
                  placeholder="Paste email text here..."
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm font-mono transition-all"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-300 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isParsing || !emailText.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-neon-violet"
                >
                  {isParsing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Gemini is Parsing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Parse with Gemini
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
