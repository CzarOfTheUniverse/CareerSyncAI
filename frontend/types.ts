export type JobStatus = 'Applied' | 'Interviewing' | 'Offered' | 'Rejected' | 'Archived';

export interface JobApplication {
  id: string;
  company: string;
  jobTitle: string;
  status: JobStatus;
  contactName?: string;
  contactEmail?: string;
  date: string;
  salary?: string;
  location?: string;
  nextSteps?: string;
  summary: string;
  emailSourceId?: string;
}

export interface EmailMessage {
  id: string;
  threadId?: string;
  sender: string;
  subject: string;
  date: string;
  body: string;
  parsed: boolean;
  jobId?: string;
}

export interface DashboardStats {
  total: number;
  applied: number;
  interviewing: number;
  offered: number;
  rejected: number;
}
