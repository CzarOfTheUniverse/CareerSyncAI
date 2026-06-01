import React from 'react';
import { JobApplication, JobStatus } from '../types';
import { Briefcase, Calendar, MapPin, DollarSign, ArrowRight } from 'lucide-react';

interface KanbanBoardProps {
  jobs: JobApplication[];
  onSelectJob: (job: JobApplication) => void;
  onUpdateStatus: (jobId: string, newStatus: JobStatus) => void;
}

const COLUMNS: { id: JobStatus; title: string; color: string; bg: string; border: string; glow: string }[] = [
  { id: 'Applied', title: 'Applied', color: 'text-blue-400', bg: 'bg-blue-950/20', border: 'border-blue-900/40', glow: 'group-hover:border-blue-500/50' },
  { id: 'Interviewing', title: 'Interviewing', color: 'text-amber-400', bg: 'bg-amber-950/20', border: 'border-amber-900/40', glow: 'group-hover:border-amber-500/50' },
  { id: 'Offered', title: 'Offered', color: 'text-emerald-400', bg: 'bg-emerald-950/20', border: 'border-emerald-900/40', glow: 'group-hover:border-emerald-500/50' },
  { id: 'Rejected', title: 'Rejected', color: 'text-rose-400', bg: 'bg-rose-950/20', border: 'border-rose-900/40', glow: 'group-hover:border-rose-500/50' },
  { id: 'Archived', title: 'Archived', color: 'text-slate-400', bg: 'bg-slate-900/20', border: 'border-slate-800/40', glow: 'group-hover:border-slate-500/50' },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ jobs, onSelectJob, onUpdateStatus }) => {
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragStart = (e: React.DragEvent, jobId: string) => {
    e.dataTransfer.setData('text/plain', jobId);
  };

  const handleDrop = (e: React.DragEvent, targetStatus: JobStatus) => {
    e.preventDefault();
    const jobId = e.dataTransfer.getData('text/plain');
    if (jobId) {
      onUpdateStatus(jobId, targetStatus);
    }
  };

  const moveJob = (jobId: string, currentStatus: JobStatus) => {
    const statusOrder: JobStatus[] = ['Applied', 'Interviewing', 'Offered', 'Rejected', 'Archived'];
    const currentIndex = statusOrder.indexOf(currentStatus);
    const nextIndex = (currentIndex + 1) % statusOrder.length;
    onUpdateStatus(jobId, statusOrder[nextIndex]);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 h-[calc(100vh-220px)] overflow-y-auto md:overflow-y-hidden animate-fade-in">
      {COLUMNS.map((column) => {
        const columnJobs = jobs.filter((j) => j.status === column.id);

        return (
          <div
            key={column.id}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.id)}
            className={`flex flex-col rounded-2xl border ${column.border} ${column.bg} p-4 h-full min-h-[300px] md:min-h-0 transition-all duration-300`}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className={`font-bold text-sm ${column.color} flex items-center gap-2`}>
                {column.title}
                <span className="px-2 py-0.5 text-xs rounded-full bg-slate-950 border border-slate-800 text-slate-300 shadow-sm">
                  {columnJobs.length}
                </span>
              </h3>
            </div>

            {/* Column Cards */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {columnJobs.length > 0 ? (
                columnJobs.map((job) => (
                  <div
                    key={job.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, job.id)}
                    onClick={() => onSelectJob(job)}
                    className="bg-slate-900 p-4 rounded-xl border border-slate-800/80 shadow-sm hover:shadow-neon-violet hover:border-brand-500/50 transition-all duration-300 cursor-grab active:cursor-grabbing group relative hover:scale-[1.02]"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-bold text-slate-100 group-hover:text-brand-400 transition-colors line-clamp-1">
                        {job.company}
                      </h4>
                      {/* Quick Move Button for Mobile/Accessibility */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveJob(job.id, job.status);
                        }}
                        title="Move to next stage"
                        className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-brand-400 md:hidden"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{job.jobTitle}</p>

                    {/* Details */}
                    <div className="mt-3 space-y-1.5 text-[11px] text-slate-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{job.date}</span>
                      </div>
                      {job.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          <span className="line-clamp-1">{job.location}</span>
                        </div>
                      )}
                      {job.salary && (
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>{job.salary}</span>
                        </div>
                      )}
                    </div>

                    {/* Summary Snippet */}
                    {job.summary && (
                      <p className="text-xs text-slate-400 mt-3 pt-2 border-t border-slate-800/50 line-clamp-2 italic">
                        "{job.summary}"
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 py-8 border-2 border-dashed border-slate-800/60 rounded-xl">
                  <Briefcase className="w-8 h-8 mb-2 opacity-50" />
                  <span className="text-xs">Drag jobs here</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
