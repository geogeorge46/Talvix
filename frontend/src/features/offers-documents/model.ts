export const OFFER_STATUSES = [
  'draft',
  'pending-approval',
  'approved',
  'rejected',
  'sent',
  'viewed',
  'negotiation-requested',
  'revised',
  'accepted',
  'declined',
  'withdrawn',
  'expired',
  'cancelled',
  'superseded',
] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];
export interface Offer {
  id: string;
  status: OfferStatus;
  title: string;
  department?: string | undefined;
  employmentType?: string | undefined;
  workMode?: string | undefined;
  joiningDate?: string | undefined;
  expiresAt?: string | undefined;
  offerNumber?: string | undefined;
  revisionNumber?: number | undefined;
  candidateName?: string | undefined;
  jobTitle?: string | undefined;
  compensation?:
    | {
        currency: string;
        period: string;
        base: number;
        variable?: number | undefined;
        bonus?: number | undefined;
        joiningBonus?: number | undefined;
      }
    | undefined;
  benefits: string[];
  terms: string[];
  clauses: {
    title: string;
    content: string;
    required: boolean;
    order: number;
  }[];
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
}
export interface OfferTemplate {
  id: string;
  name: string;
  description?: string | undefined;
  employmentType?: string | undefined;
  defaultTitle?: string | undefined;
  approvalRequired: boolean;
  isReusable: boolean;
  isActive: boolean;
  usageCount?: number | undefined;
}
export interface OfferTimelineItem {
  status: OfferStatus;
  changedAt: string;
}
export interface DocumentRecord {
  id: string;
  category: string;
  purpose: string;
  displayName: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  scanStatus: string;
  version: number;
  isCurrent: boolean;
  entityType?: string | undefined;
  entityId?: string | undefined;
  access: string;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
  verification: {
    required: boolean;
    status: 'pending' | 'verified' | 'rejected' | 'not-required';
    submittedAt?: string | undefined;
    reviewedAt?: string | undefined;
    reason?: string | undefined;
  };
}
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
const text = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback;
const num = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const id = (v: Record<string, unknown>) => text(v.id ?? v._id);
const strings = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
export function toOffer(value: unknown): Offer {
  const v = record(value),
    candidate = record(v.candidateSnapshot),
    job = record(v.jobSnapshot),
    c = record(v.compensation);
  const status = OFFER_STATUSES.includes(v.status as OfferStatus)
    ? (v.status as OfferStatus)
    : 'draft';
  return {
    id: id(v),
    status,
    title: text(v.title, text(job.title, 'Untitled offer')),
    department: text(v.department) || undefined,
    employmentType: text(v.employmentType) || undefined,
    workMode: text(v.workMode) || undefined,
    joiningDate: text(v.joiningDate) || undefined,
    expiresAt: text(v.expiresAt ?? v.expiryDate) || undefined,
    offerNumber: text(v.offerNumber) || undefined,
    revisionNumber: num(v.revision, 1),
    candidateName: text(
      v.candidateName,
      text(candidate.fullName, text(candidate.name, 'Candidate')),
    ),
    jobTitle: text(job.title) || undefined,
    compensation: Object.keys(c).length
      ? {
          currency: text(c.currency, 'INR'),
          period: text(c.period, 'annual'),
          base: num(c.base),
          variable: num(c.variable),
          bonus: num(c.bonus),
          joiningBonus: num(c.joiningBonus),
        }
      : undefined,
    benefits: strings(v.benefits),
    terms: strings(v.terms),
    clauses: Array.isArray(v.clauses)
      ? v.clauses
          .map((x) => record(x))
          .map((x) => ({
            title: text(x.title),
            content: text(x.content),
            required: x.required !== false,
            order: num(x.order),
          }))
      : [],
    createdAt: text(v.createdAt) || undefined,
    updatedAt: text(v.updatedAt) || undefined,
  };
}
export function toCandidateOffer(value: unknown): Offer {
  return toOffer(value);
}
export function toTemplate(value: unknown): OfferTemplate {
  const v = record(value);
  return {
    id: id(v),
    name: text(v.name, 'Untitled template'),
    description: text(v.description) || undefined,
    employmentType: text(v.employmentType) || undefined,
    defaultTitle: text(v.defaultTitle) || undefined,
    approvalRequired: v.approvalRequired !== false,
    isReusable: v.isReusable !== false,
    isActive: v.isActive !== false,
    usageCount: num(v.usageCount),
  };
}
export function toTimeline(value: unknown): OfferTimelineItem[] {
  return Array.isArray(value)
    ? value
        .map(record)
        .filter((v) => OFFER_STATUSES.includes(v.status as OfferStatus))
        .map((v) => ({
          status: v.status as OfferStatus,
          changedAt: text(v.changedAt),
        }))
    : [];
}
export function toDocument(value: unknown): DocumentRecord {
  const v = record(value),
    verify = record(v.verification);
  return {
    id: id(v),
    category: text(v.category, 'other'),
    purpose: text(v.purpose),
    displayName: text(v.displayName, text(v.originalFileName, 'Document')),
    originalFileName: text(v.originalFileName),
    mimeType: text(v.mimeType),
    sizeBytes: num(v.sizeBytes),
    status: text(v.status),
    scanStatus: text(v.scanStatus),
    version: num(v.version, 1),
    isCurrent: v.isCurrent !== false,
    entityType: text(v.entityType) || undefined,
    entityId: text(v.entityId) || undefined,
    access: text(v.access),
    createdAt: text(v.createdAt) || undefined,
    updatedAt: text(v.updatedAt) || undefined,
    verification: {
      required: verify.required === true,
      status: ['pending', 'verified', 'rejected', 'not-required'].includes(
        text(verify.status),
      )
        ? (text(verify.status) as DocumentRecord['verification']['status'])
        : 'not-required',
      submittedAt: text(verify.submittedAt) || undefined,
      reviewedAt: text(verify.reviewedAt) || undefined,
      reason: text(verify.reason) || undefined,
    },
  };
}
export const offerTone = (
  status: OfferStatus,
): 'neutral' | 'success' | 'warning' | 'danger' | 'info' =>
  ['accepted', 'approved'].includes(status)
    ? 'success'
    : ['expired', 'declined', 'withdrawn', 'cancelled'].includes(status)
      ? 'danger'
      : ['pending-approval', 'negotiation-requested', 'rejected'].includes(
            status,
          )
        ? 'warning'
        : ['sent', 'viewed', 'revised'].includes(status)
          ? 'info'
          : 'neutral';
export const activeCandidateActions = (status: OfferStatus) =>
  ['sent', 'viewed', 'revised'].includes(status);
export const formatMoney = (o: Offer) =>
  o.compensation
    ? new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: o.compensation.currency,
        maximumFractionDigits: 0,
      }).format(o.compensation.base) + ` / ${o.compensation.period}`
    : 'Not provided';
export const formatBytes = (n: number) =>
  n < 1024
    ? `${n} B`
    : n < 1048576
      ? `${(n / 1024).toFixed(1)} KB`
      : `${(n / 1048576).toFixed(1)} MB`;
