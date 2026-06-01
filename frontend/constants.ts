import { EmailMessage, JobApplication } from './types';

export const MOCK_EMAILS: EmailMessage[] = [
  {
    id: 'email-1',
    sender: 'recruiting@stripe.com',
    subject: 'Thank you for applying to Stripe!',
    date: '2025-02-10',
    body: `Hi there,

Thank you for your interest in Stripe! We have received your application for the Software Engineer, Frontend position. 

Our recruiting team is currently reviewing your background and experience. We will be in touch within the next week regarding next steps.

Best regards,
The Stripe Recruiting Team`,
    parsed: false
  },
  {
    id: 'email-2',
    sender: 'careers@google.com',
    subject: 'Google Interview Invitation: Software Engineer II',
    date: '2025-02-12',
    body: `Hello,

Great news! We would love to invite you to a technical interview for the Software Engineer II role at Google. 

This will be a 45-minute video call focusing on data structures and algorithms. Please use the link below to select 3 convenient times for you next week.

Interview Coordinator: Sarah Jenkins (sjenkins@google.com)
Location: Remote (Google Meet)

Best,
Google Careers`,
    parsed: false
  },
  {
    id: 'email-3',
    sender: 'talent@netflix.com',
    subject: 'Update on your application for Senior Frontend Engineer',
    date: '2025-02-14',
    body: `Dear Applicant,

Thank you for taking the time to apply and speak with us about the Senior Frontend Engineer position at Netflix. 

While we were highly impressed with your background, we have decided to move forward with other candidates whose experience more closely aligns with our current needs. 

We will keep your resume on file for future opportunities. We wish you the best of luck in your job search.

Sincerely,
Netflix Talent Acquisition`,
    parsed: false
  },
  {
    id: 'email-4',
    sender: 'offers@canva.com',
    subject: 'Job Offer: Frontend Engineer at Canva!',
    date: '2025-02-18',
    body: `Hi!

We are absolutely thrilled to offer you the position of Frontend Engineer at Canva! 

We were incredibly impressed by your technical skills and cultural fit during the interview process. We are offering a base salary of $145,000 USD per year, plus equity and comprehensive benefits. 

Please review the attached offer letter and let us know your decision by Friday, February 21st.

Welcome to the team!
Canva People Group`,
    parsed: false
  },
  {
    id: 'email-5',
    sender: 'jobs@vercel.com',
    subject: 'Vercel Technical Assessment: Developer Advocate',
    date: '2025-02-19',
    body: `Hey,

Thanks for chatting with us yesterday! We'd love to move you to the next stage, which is a take-home technical assessment.

For this challenge, you will build a small Next.js application demonstrating edge middleware. Please submit your GitHub repository link within 5 days.

If you have any questions, feel free to reply to this email.

Cheers,
Vercel Recruiting`,
    parsed: false
  }
];

export const INITIAL_JOBS: JobApplication[] = [
  {
    id: 'job-1',
    company: 'Airbnb',
    jobTitle: 'Senior React Developer',
    status: 'Interviewing',
    contactName: 'Marcus Aurelius',
    contactEmail: 'marcus@airbnb.com',
    date: '2025-02-01',
    salary: '$160,000',
    location: 'Remote (US)',
    nextSteps: 'System Design Interview on Feb 22',
    summary: 'Applied via referral. Completed initial recruiter screen and coding challenge. Next up is system design.',
  },
  {
    id: 'job-2',
    company: 'Figma',
    jobTitle: 'Product Engineer',
    status: 'Applied',
    contactName: 'Figma Recruiting',
    contactEmail: 'careers@figma.com',
    date: '2025-02-05',
    salary: '$150,000',
    location: 'San Francisco, CA',
    nextSteps: 'Awaiting recruiter response',
    summary: 'Applied directly on Figma careers page. Received automated confirmation email.',
  },
  {
    id: 'job-3',
    company: 'Meta',
    jobTitle: 'Frontend Engineer',
    status: 'Rejected',
    contactName: 'Meta Careers',
    contactEmail: 'no-reply@meta.com',
    date: '2025-01-20',
    salary: '$180,000',
    location: 'Menlo Park, CA',
    nextSteps: 'None',
    summary: 'Completed full loop. Received rejection email citing team matching constraints.',
  }
];
