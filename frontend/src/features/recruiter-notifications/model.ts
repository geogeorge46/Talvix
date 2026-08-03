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

export const toSafeNotification = (value: unknown): SafeNotification => {
  const v = record(value);
  return {
    id: id(v),
    title: text(v.title),
    message: text(v.message),
    type: text(v.type),
    category: optionalText(v.category) as any,
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
