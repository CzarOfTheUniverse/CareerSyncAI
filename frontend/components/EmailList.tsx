import React, { useState } from 'react';
import { EmailMessage } from '../types';
import { Mail, Sparkles, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface EmailListProps {
  emails: EmailMessage[];
  onParseEmail: (emailId: string) => Promise<void>;
  isParsing: string | null; // ID of email currently parsing
  authType: 'google' | 'demo' | null;
}

export const EmailList: React.FC<EmailListProps> = ({ emails, onParseEmail, isParsing, authType }) => {
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const inboxLabel = authType === 'google' ? 'Gmail Inbox' : 'Demo Gmail Inbox';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-220px)] animate-fade-in">
      {/* Email List Panel */}
      <div className="lg:col-span-1 bg-slate-900/80 rounded-2xl border border-slate-800/80 shadow-sm flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <h3 className="font-bold text-slate-100 flex items-center gap-2">
            <Mail className="w-5 h-5 text-brand-400" />
            {inboxLabel}
          </h3>
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
            {emails.length} Messages
          </span>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50">
          {emails.map((email) => (
            <div
              key={email.id}
              onClick={() => setSelectedEmail(email)}
              className={`p-4 cursor-pointer transition-all duration-200 text-left ${
                selectedEmail?.id === email.id ? 'bg-brand-500/10 border-l-4 border-brand-500' : 'hover:bg-slate-800/30'
              }`}
            >
              <div className="flex justify-between items-start gap-2">
                <span className="font-semibold text-slate-200 text-sm truncate">{email.sender}</span>
                <span className="text-xs text-slate-500 whitespace-nowrap">{email.date}</span>
              </div>
              <h4 className="font-medium text-slate-300 text-xs mt-1 truncate">{email.subject}</h4>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">{email.body}</p>
              
              <div className="mt-3 flex items-center justify-between">
                {email.parsed ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <CheckCircle className="w-3 h-3" /> Synced to Tracker
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    <AlertCircle className="w-3 h-3" /> Unparsed
                  </span>
                )}

                {isParsing === email.id ? (
                  <span className="text-xs text-brand-400 flex items-center gap-1 font-medium">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Parsing...
                  </span>
                ) : !email.parsed ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onParseEmail(email.id);
                    }}
                    className="text-xs text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1 hover:underline transition-colors"
                  >
                    <Sparkles className="w-3 h-3" /> Parse with Gemini
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Email Detail Panel */}
      <div className="lg:col-span-2 bg-slate-900/80 rounded-2xl border border-slate-800/80 shadow-sm flex flex-col overflow-hidden">
        {selectedEmail ? (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-6 border-b border-slate-800">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-100">{selectedEmail.subject}</h2>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
                    <span>From: <strong className="text-slate-200">{selectedEmail.sender}</strong></span>
                    <span>Date: {selectedEmail.date}</span>
                  </div>
                </div>
                <div>
                  {selectedEmail.parsed ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <CheckCircle className="w-4 h-4" /> Synced
                    </span>
                  ) : (
                    <button
                      onClick={() => onParseEmail(selectedEmail.id)}
                      disabled={isParsing === selectedEmail.id}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-neon-violet"
                    >
                      {isParsing === selectedEmail.id ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Gemini is Parsing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Parse with Gemini AI
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 p-6 overflow-y-auto bg-slate-950/30">
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800/80 shadow-sm whitespace-pre-wrap text-slate-300 text-sm leading-relaxed">
                {selectedEmail.body}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8">
            <Mail className="w-16 h-16 mb-4 text-slate-700" />
            <h3 className="font-bold text-slate-300 text-lg">No Email Selected</h3>
            <p className="text-sm text-center max-w-md mt-1">
              Select an email from the inbox to view its full content and trigger Gemini AI parsing to automatically extract job details.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
