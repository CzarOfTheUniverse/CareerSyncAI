import React, { useState, useMemo } from 'react';
import { JobApplication, JobStatus } from '../types';
import { 
  Search, 
  Filter, 
  Download, 
  Plus, 
  Briefcase, 
  Calendar, 
  MapPin, 
  DollarSign, 
  ChevronRight,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Archive
} from 'lucide-react';

interface DashboardProps {
  jobs: JobApplication[];
  onSelectJob: (job: JobApplication) => void;
  onAddJobClick: () => void;
}

type SortField = 'date' | 'company' | 'jobTitle' | 'salary' | 'location' | 'status';

export const Dashboard: React.FC<DashboardProps> = ({ jobs, onSelectJob, onAddJobClick }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Calculate Stats
  const stats = useMemo(() => {
    return {
      total: jobs.length,
      applied: jobs.filter(j => j.status === 'Applied').length,
      interviewing: jobs.filter(j => j.status === 'Interviewing').length,
      offered: jobs.filter(j => j.status === 'Offered').length,
      rejected: jobs.filter(j => j.status === 'Rejected').length,
    };
  }, [jobs]);

  // Filter & Sort Jobs with multi-word fuzzy matching across all visible columns
  const filteredJobs = useMemo(() => {
    return jobs
      .filter(job => {
        // Status filter check
        const matchesStatus = statusFilter === 'All' || job.status === statusFilter;
        if (!matchesStatus) return false;

        // Search term check (split into words for multi-word fuzzy matching across all columns)
        if (!searchTerm.trim()) return true;
        
        const searchWords = searchTerm.toLowerCase().trim().split(/\s+/);
        
        // All typed words must match at least one visible column field in the job application
        return searchWords.every(word => {
          const fieldsToSearch = [
            job.company,
            job.jobTitle,
            job.status,
            job.location,
            job.salary,
            job.contactName,
            job.contactEmail,
            job.date
          ];
          
          return fieldsToSearch.some(field => 
            field && field.toLowerCase().includes(word)
          );
        });
      })
      .sort((a, b) => {
        let comparison = 0;
        if (sortBy === 'date') {
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
        } else if (sortBy === 'company') {
          comparison = a.company.localeCompare(b.company);
        } else if (sortBy === 'jobTitle') {
          comparison = a.jobTitle.localeCompare(b.jobTitle);
        } else if (sortBy === 'salary') {
          const valA = parseFloat(a.salary?.replace(/[^0-9.]/g, '') || '0');
          const valB = parseFloat(b.salary?.replace(/[^0-9.]/g, '') || '0');
          comparison = valA - valB;
        } else if (sortBy === 'location') {
          comparison = (a.location || '').localeCompare(b.location || '');
        } else if (sortBy === 'status') {
          comparison = a.status.localeCompare(b.status);
        }
        return sortOrder === 'desc' ? -comparison : comparison;
      });
  }, [jobs, searchTerm, statusFilter, sortBy, sortOrder]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Company', 'Job Title', 'Status', 'Contact Name', 'Contact Email', 'Date', 'Salary', 'Location', 'Next Steps', 'Summary'];
    const rows = jobs.map(job => [
      job.company,
      job.jobTitle,
      job.status,
      job.contactName || '',
      job.contactEmail || '',
      job.date,
      job.salary || '',
      job.location || '',
      job.nextSteps || '',
      job.summary.replace(/"/g, '""')
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `career_sync_jobs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: JobStatus) => {
    switch (status) {
      case 'Applied':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Clock className="w-3.5 h-3.5" /> Applied
          </span>
        );
      case 'Interviewing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertCircle className="w-3.5 h-3.5" /> Interviewing
          </span>
        );
      case 'Offered':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Offered
          </span>
        );
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" /> Rejected
          </span>
        );
      case 'Archived':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <Archive className="w-3.5 h-3.5" /> Archived
          </span>
        );
    }
  };

  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Applications', value: stats.total, color: 'text-slate-100', glow: 'hover:shadow-neon-violet' },
          { label: 'Applied', value: stats.applied, color: 'text-blue-400', glow: 'hover:shadow-neon-cyan' },
          { label: 'Interviewing', value: stats.interviewing, color: 'text-amber-400', glow: 'hover:shadow-neon-pink' },
          { label: 'Offers', value: stats.offered, color: 'text-emerald-400', glow: 'hover:shadow-neon-cyan' },
          { label: 'Rejections', value: stats.rejected, color: 'text-rose-400', glow: 'hover:shadow-neon-pink', colSpan: 'col-span-2 md:col-span-1' }
        ].map((stat, idx) => (
          <div 
            key={idx} 
            className={`bg-slate-900/80 p-4 rounded-2xl border border-slate-800/80 shadow-sm transition-all duration-300 hover:scale-[1.02] ${stat.glow} ${stat.colSpan || ''}`}
          >
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{stat.label}</p>
            <p className={`text-3xl font-extrabold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters & Actions */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900/80 p-4 rounded-2xl border border-slate-800/80 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
            <input
              type="text"
              placeholder="Search company, title, location, status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm transition-all"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-10 pr-8 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm appearance-none cursor-pointer transition-all"
            >
              <option value="All">All Statuses</option>
              <option value="Applied">Applied</option>
              <option value="Interviewing">Interviewing</option>
              <option value="Offered">Offered</option>
              <option value="Rejected">Rejected</option>
              <option value="Archived">Archived</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 w-full md:w-auto justify-end">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-300 text-sm font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={onAddJobClick}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-neon-violet hover:shadow-neon-violet-strong"
          >
            <Plus className="w-4 h-4" /> Add Job
          </button>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="bg-slate-900/80 rounded-2xl border border-slate-800/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <th className="py-4 px-6 cursor-pointer hover:bg-slate-800/50 transition-colors" onClick={() => toggleSort('company')}>
                  Company {sortBy === 'company' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
                <th className="py-4 px-6 cursor-pointer hover:bg-slate-800/50 transition-colors" onClick={() => toggleSort('jobTitle')}>
                  Job Title {sortBy === 'jobTitle' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
                <th className="py-4 px-6 cursor-pointer hover:bg-slate-800/50 transition-colors" onClick={() => toggleSort('status')}>
                  Status {sortBy === 'status' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
                <th className="py-4 px-6 cursor-pointer hover:bg-slate-800/50 transition-colors" onClick={() => toggleSort('date')}>
                  Date {sortBy === 'date' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
                <th className="py-4 px-6 cursor-pointer hover:bg-slate-800/50 transition-colors" onClick={() => toggleSort('location')}>
                  Location {sortBy === 'location' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
                <th className="py-4 px-6 cursor-pointer hover:bg-slate-800/50 transition-colors" onClick={() => toggleSort('salary')}>
                  Salary {sortBy === 'salary' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
                <th className="py-4 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-sm">
              {filteredJobs.length > 0 ? (
                filteredJobs.map((job) => (
                  <tr 
                    key={job.id} 
                    onClick={() => onSelectJob(job)}
                    className="hover:bg-slate-800/30 cursor-pointer transition-all duration-200 group"
                  >
                    <td className="py-4 px-6 font-semibold text-slate-100">{job.company}</td>
                    <td className="py-4 px-6 text-slate-300">{job.jobTitle}</td>
                    <td className="py-4 px-6">{getStatusBadge(job.status)}</td>
                    <td className="py-4 px-6 text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-slate-500" />
                        {job.date}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-400">
                      {job.location ? (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-slate-500" />
                          {job.location}
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-slate-400">
                      {job.salary ? (
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4 text-slate-500" />
                          {job.salary}
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 group-hover:text-brand-400 transition-colors">
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <Briefcase className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                    <p className="font-medium text-slate-400">No job applications found</p>
                    <p className="text-xs mt-1">Try adjusting your search or filters, or add a new job manually.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
