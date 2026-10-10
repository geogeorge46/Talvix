const record = (v: unknown) => v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
const text = (v: unknown) => typeof v === 'string' ? v : '';
const optionalText = (v: unknown) => typeof v === 'string' ? v : undefined;
const id = (v: Record<string, unknown>) => typeof v._id === 'string' ? v._id : typeof v.id === 'string' ? v.id : '';

export interface SafeNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  category?: string;
  createdAt: string;
  read: boolean;
  archived: boolean;
  target?: string;
  priority?: string;
  actions?: any[];
}

const formatNotificationContent = (
  rawTitle: string,
  rawMessage: string,
  type: string,
  category?: string,
  data?: Record<string, unknown>
): { title: string; message: string } => {
  let title = rawTitle;
  let message = rawMessage;

  const isGenericTitle = !title || title === 'Talvix update' || title === 'Notification';
  const isGenericMessage = !message || message === 'You have a new Talvix update.' || message === 'You have a new update.';

  const cat = category || type.split('-')[0] || '';
  const jobTitle = typeof data?.jobTitle === 'string' ? data.jobTitle : '';
  const companyName = typeof data?.companyName === 'string' ? data.companyName : '';
  const prefix = companyName && jobTitle ? `${companyName} · ${jobTitle}` : companyName || jobTitle || '';

  if (isGenericTitle || isGenericMessage) {
    if (type.includes('offer') || cat === 'offer') {
      if (isGenericTitle) title = '📄 Offer Notification';
      if (isGenericMessage) {
        message = prefix
          ? `${prefix}: An offer workflow update occurred.`
          : 'An offer workflow update occurred.';
      }
    } else if (type.includes('interview') || cat === 'interview') {
      if (isGenericTitle) title = '📅 Interview Update';
      if (isGenericMessage) {
        message = prefix
          ? `${prefix}: An interview schedule update occurred.`
          : 'An interview schedule update occurred.';
      }
    } else if (type.includes('assessment') || cat === 'assessment') {
      if (isGenericTitle) title = '📋 Assessment Notification';
      if (isGenericMessage) {
        message = prefix
          ? `${prefix}: An assessment submission update occurred.`
          : 'An assessment submission update occurred.';
      }
    } else if (type.includes('application') || cat === 'application') {
      if (isGenericTitle) title = '💼 Candidate Application Update';
      if (isGenericMessage) {
        message = prefix
          ? `${prefix}: Candidate application status was updated.`
          : 'Candidate application status was updated.';
      }
    } else if (type.includes('document') || cat === 'document') {
      if (isGenericTitle) title = '📁 Document Verification Update';
      if (isGenericMessage) {
        message = 'A candidate document verification update occurred.';
      }
    } else {
      if (isGenericTitle) title = '🔔 System Alert';
      if (isGenericMessage) message = 'You have a new recruiter notification in Talvix.';
    }
  }

  return { title, message };
};

export const toSafeNotification = (value: unknown): SafeNotification => {
  const v = record(value),
    type = text(v.type),
    category = optionalText(v.category) as any,
    data = record(v.data),
    formatted = formatNotificationContent(text(v.title), text(v.message), type, category, data);

  return {
    id: id(v),
    title: formatted.title,
    message: formatted.message,
    type,
    category,
    createdAt: text(v.createdAt),
    read: v.isRead === true || v.read === true,
    archived: v.isArchived === true || v.archived === true,
    priority: optionalText(v.priority) as any,
    actions: (Array.isArray(v.actions) ? v.actions : undefined) as any,
  };
};

export interface SafeNotificationPreferences {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  digestEnabled: boolean;
  digestFrequency: 'daily' | 'weekly';
  timezone: string;
  preferredHour: number;
  quietHoursEnabled: boolean;
  quietStartHour: number;
  quietEndHour: number;
}

export const toSafeNotificationPreferences = (
  value: unknown,
): SafeNotificationPreferences => {
  const v = record(value),
    global = record(v.global),
    digest = record(v.digest),
    quiet = record(v.quietHours);
  return {
    inAppEnabled: global.inAppEnabled !== false,
    emailEnabled: global.emailEnabled !== false,
    digestEnabled: digest.enabled === true,
    digestFrequency: digest.frequency === 'weekly' ? 'weekly' : 'daily',
    timezone: typeof digest.timezone === 'string' ? digest.timezone : 'UTC',
    preferredHour:
      typeof digest.preferredHour === 'number' ? digest.preferredHour : 9,
    quietHoursEnabled: quiet.enabled === true,
    quietStartHour: typeof quiet.startHour === 'number' ? quiet.startHour : 22,
    quietEndHour: typeof quiet.endHour === 'number' ? quiet.endHour : 7,
  };
};
