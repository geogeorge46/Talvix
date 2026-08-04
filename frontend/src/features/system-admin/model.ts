export type AdminRecord = Record<string, unknown> & { _id?: string; id?: string };
export interface PageMeta { page?: number | undefined; limit?: number | undefined; total?: number | undefined; pages?: number | undefined }
export interface AdminCollection { rows: AdminRecord[]; meta: PageMeta }
export const APPLICATION_ADMIN_STATUSES = [
  'submitted', 'under-review', 'shortlisted', 'assessment-pending',
  'assessment-in-progress', 'assessment-completed', 'interview-scheduled',
  'interview-completed', 'offer-pending', 'offer-sent', 'offer-accepted',
  'offer-declined', 'hired', 'rejected', 'withdrawn',
] as const;

const privateKeys = new Set([
  'answers', 'correctAnswer', 'correctAnswers', 'explanation', 'hiddenTests',
  'testCases', 'rawSnapshot', 'providerMetadata', 'checksum', 'signedUrl',
  'privateNotes', 'securityDetails', 'credentials',
]);

export function recordId(value: AdminRecord) {
  return String(value._id ?? value.id ?? '');
}

export function collectionFrom(value: unknown): AdminCollection {
  if (Array.isArray(value)) return { rows: value as AdminRecord[], meta: {} };
  if (!value || typeof value !== 'object') return { rows: [], meta: {} };
  const source = value as Record<string, unknown>;
  const rows = (['rows', 'items', 'results', 'records', 'data', 'docs', 'notifications',
    'templates', 'events', 'logs', 'assignments', 'attempts', 'processes',
    'offers', 'documents', 'applications', 'recruiters', 'companies', 'jobs',
    'users', 'questions', 'emailLogs', 'audits']
    .map((key) => source[key]).find(Array.isArray) ?? []) as AdminRecord[];
  const pagination = (source.pagination ?? source.meta ?? {}) as Record<string, unknown>;
  return {
    rows: rows.map(sanitizeRecord),
    meta: {
      page: numberValue(pagination.page ?? source.page),
      limit: numberValue(pagination.limit ?? source.limit),
      total: numberValue(pagination.total ?? source.total),
      pages: numberValue(pagination.pages ?? pagination.totalPages ?? source.totalPages),
    },
  };
}

export function sanitizeRecord(record: AdminRecord): AdminRecord {
  return sanitizeObject(record) as AdminRecord;
}

function sanitizeObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeObject);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !privateKeys.has(key))
    .map(([key, child]) => [key, sanitizeObject(child)]));
}

export function detailFrom(value: unknown): AdminRecord {
  if (!value || typeof value !== 'object') return {};
  const source = value as AdminRecord;
  const nested = ['application', 'assignment', 'attempt', 'process', 'schedule',
    'feedback', 'offer', 'document', 'notification', 'template', 'emailLog', 'event']
    .map((key) => source[key]).find((item) => item && typeof item === 'object' && !Array.isArray(item));
  return sanitizeRecord((nested ?? source) as AdminRecord);
}

function numberValue(value: unknown) {
  return typeof value === 'number' ? value : undefined;
}

export function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return `${value.length} items`;
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>;
    return String(v.name ?? v.title ?? v.email ?? v._id ?? v.id ?? 'Linked record');
  }
  return '—';
}

export function compactQuery(values: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && String(value).trim()) query.set(key, String(value));
  });
  const text = query.toString();
  return text ? `?${text}` : '';
}
