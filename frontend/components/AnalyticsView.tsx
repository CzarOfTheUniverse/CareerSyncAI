import React, { useMemo, useState } from 'react';
import { JobApplication } from '../types';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line
} from 'recharts';
import { TrendingUp, Award, CheckCircle, XCircle } from 'lucide-react';

interface AnalyticsViewProps {
  jobs: JobApplication[];
}

type Granularity = 'day' | 'week' | 'month' | 'year';

const COLORS = {
  Applied: '#3b82f6',      // Blue
  Interviewing: '#f59e0b', // Amber
  Offered: '#10b981',      // Emerald
  Rejected: '#f43f5e',     // Rose
  Archived: '#64748b'      // Slate
};

// ISO week number — Monday-based, matches what most calendars show.
function isoWeek(d: Date): { year: number; week: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: date.getUTCFullYear(), week };
}

function bucketKey(dateStr: string, granularity: Granularity): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  switch (granularity) {
    case 'day':   return `${y}-${m}-${day}`;
    case 'week': {
      const { year, week } = isoWeek(d);
      return `${year}-W${String(week).padStart(2, '0')}`;
    }
    case 'month': return `${y}-${m}`;
    case 'year':  return `${y}`;
  }
}

const GRANULARITY_LABEL: Record<Granularity, string> = {
  day: 'Daily', week: 'Weekly', month: 'Monthly', year: 'Yearly',
};

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ jobs }) => {
  const [granularity, setGranularity] = useState<Granularity>(() => {
    const saved = localStorage.getItem('career_sync_analytics_granularity') as Granularity | null;
    return saved && ['day', 'week', 'month', 'year'].includes(saved) ? saved : 'month';
  });

  const updateGranularity = (g: Granularity) => {
    setGranularity(g);
    localStorage.setItem('career_sync_analytics_granularity', g);
  };

  // 1. Status Distribution Data
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {
      Applied: 0,
      Interviewing: 0,
      Offered: 0,
      Rejected: 0,
      Archived: 0
    };
    jobs.forEach(j => {
      if (counts[j.status] !== undefined) {
        counts[j.status]++;
      }
    });
    return Object.keys(counts).map(key => ({
      name: key,
      value: counts[key],
      color: COLORS[key as keyof typeof COLORS]
    })).filter(item => item.value > 0);
  }, [jobs]);

  // 2. Timeline Data (Applications over time) — bucketed by selected granularity.
  const timelineData = useMemo(() => {
    const dateMap: Record<string, number> = {};
    jobs.forEach(j => {
      const key = bucketKey(j.date, granularity);
      if (key) dateMap[key] = (dateMap[key] || 0) + 1;
    });
    return Object.keys(dateMap)
      .sort()
      .map(bucket => ({ bucket, Applications: dateMap[bucket] }));
  }, [jobs, granularity]);

  // 3. Key Metrics
  const metrics = useMemo(() => {
    const total = jobs.length;
    const offered = jobs.filter(j => j.status === 'Offered').length;
    const interviewing = jobs.filter(j => j.status === 'Interviewing').length;
    const rejected = jobs.filter(j => j.status === 'Rejected').length;

    const interviewRate = total > 0 ? Math.round(((interviewing + offered) / total) * 100) : 0;
    const offerRate = total > 0 ? Math.round((offered / total) * 100) : 0;

    return {
      interviewRate,
      offerRate,
      offered,
      rejected
    };
  }, [jobs]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-800/80 shadow-sm flex items-center gap-4 hover:scale-[1.02] transition-all duration-300 hover:shadow-neon-violet">
          <div className="p-3 rounded-xl bg-brand-500/10 text-brand-400">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">Interview Rate</p>
            <p className="text-2xl font-bold text-slate-100">{metrics.interviewRate}%</p>
          </div>
        </div>

        <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-800/80 shadow-sm flex items-center gap-4 hover:scale-[1.02] transition-all duration-300 hover:shadow-neon-cyan">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">Offer Rate</p>
            <p className="text-2xl font-bold text-slate-100">{metrics.offerRate}%</p>
          </div>
        </div>

        <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-800/80 shadow-sm flex items-center gap-4 hover:scale-[1.02] transition-all duration-300 hover:shadow-neon-cyan">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">Total Offers</p>
            <p className="text-2xl font-bold text-slate-100">{metrics.offered}</p>
          </div>
        </div>

        <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-800/80 shadow-sm flex items-center gap-4 hover:scale-[1.02] transition-all duration-300 hover:shadow-neon-pink">
          <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">Total Rejections</p>
            <p className="text-2xl font-bold text-slate-100">{metrics.rejected}</p>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution Chart */}
        <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-800/80 shadow-sm flex flex-col">
          <h3 className="font-bold text-slate-100 mb-4">Application Status Distribution</h3>
          <div className="flex-1 min-h-[300px] flex items-center justify-center">
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-500 text-sm">No data available to display.</p>
            )}
          </div>
        </div>

        {/* Timeline Chart */}
        <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-800/80 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <h3 className="font-bold text-slate-100">
              Application Timeline ({GRANULARITY_LABEL[granularity]})
            </h3>
            <div className="inline-flex rounded-xl border border-slate-800 bg-slate-950 p-1 text-xs font-semibold">
              {(['day', 'week', 'month', 'year'] as Granularity[]).map(g => (
                <button
                  key={g}
                  onClick={() => updateGranularity(g)}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    granularity === g
                      ? 'bg-brand-500/15 text-brand-300 border border-brand-500/30'
                      : 'text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  {GRANULARITY_LABEL[g]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-h-[300px]">
            {timelineData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timelineData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="bucket"
                    stroke="#64748b"
                    fontSize={12}
                    interval="preserveStartEnd"
                    minTickGap={20}
                  />
                  <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Applications"
                    stroke="#8b5cf6"
                    strokeWidth={3}
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-500 text-sm flex items-center justify-center h-full">No timeline data available.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
