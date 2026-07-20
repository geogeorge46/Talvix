export type UserRole = 'candidate' | 'recruiter' | 'admin';
export interface User {
  _id: string;
  fullName: string;
  email: string;
  role: UserRole;
  profileCompleted: boolean;
  avatar?: string | null;
  isVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastLogin?: string | null;
}
export interface CompanySummary {
  _id: string;
  name: string;
  slug: string;
  verificationStatus: string;
  isActive: boolean;
  logo?: string | null;
}
export interface RecruiterContext {
  isApproved: boolean;
  isCompanyOwner: boolean;
  permissions: string[];
  company?: CompanySummary | null;
}
export type CapabilityStatus = 'idle' | 'loading' | 'resolved' | 'error';
export const RECRUITER_PERMISSIONS = [
  'company.manage',
  'jobs.create',
  'jobs.update',
  'jobs.delete',
  'jobs.publish',
  'applications.view',
  'applications.manage',
  'assessments.view',
  'assessments.manage',
  'assessments.assign',
  'assessments.review',
  'interviews.view',
  'interviews.manage',
  'interviews.schedule',
  'interviews.evaluate',
  'offers.view',
  'offers.manage',
  'offers.approve',
  'offers.send',
  'team.manage',
  'documents.view',
  'documents.manage',
  'documents.verify',
] as const;
export type RecruiterPermission = (typeof RECRUITER_PERMISSIONS)[number];
export type AuthStatus =
  'restoring' | 'authenticated' | 'anonymous' | 'session-expired';
