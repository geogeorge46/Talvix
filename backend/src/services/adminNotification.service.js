import { EmailLog } from '../models/EmailLog.js';
import { Notification } from '../models/Notification.js';
import { NotificationOutbox } from '../models/NotificationOutbox.js';
import { AppError } from '../shared/errors/AppError.js';
import { buildPagination } from '../utils/pagination.js';
import { maskEmail, serializeAdminNotification } from '../utils/notificationSerializer.js';

const paged = async (model, filter, query, populate) => {
  const cursor = model.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit);
  if (populate) cursor.populate(populate);
  const [rows, total] = await Promise.all([cursor, model.countDocuments(filter)]);
  return { rows, pagination: buildPagination(query.page, query.limit, total) };
};
export const listNotifications = async (query) => {
  const filter = Object.fromEntries(['recipient','company','type','category','priority'].filter((key) => query[key] !== undefined).map((key) => [key, query[key]]));
  if (query.emailStatus) filter['emailDelivery.status'] = query.emailStatus;
  const result = await paged(Notification, filter, query, { path: 'recipient', select: 'email' });
  return { notifications: result.rows.map((item) => serializeAdminNotification(item, item.recipient?.email)), pagination: result.pagination };
};
export const getNotification = async (id) => { const item = await Notification.findById(id).populate('recipient', 'email'); if (!item) throw new AppError('Notification not found', 404); return serializeAdminNotification(item, item.recipient?.email); };
export const listEmailLogs = async (query) => { const result = await paged(EmailLog, query.emailStatus ? { status: query.emailStatus } : {}, query); return { emailLogs: result.rows.map((log) => ({ id: log.id, notification: log.notification, recipient: log.recipient, to: maskEmail(log.to), subject: log.subject, templateKey: log.templateKey, provider: log.provider, status: log.status, attempt: log.attempt, failureCode: log.failureCode, createdAt: log.createdAt })), pagination: result.pagination }; };
export const listOutbox = async (query) => { const result = await paged(NotificationOutbox, query.outboxStatus ? { status: query.outboxStatus } : {}, query); return { events: result.rows.map((event) => ({ id: event.id, eventType: event.eventType, recipientIds: event.recipientIds, company: event.company, status: event.status, attempts: event.attempts, maxAttempts: event.maxAttempts, availableAt: event.availableAt, processedAt: event.processedAt, lastError: event.lastError, createdAt: event.createdAt })), pagination: result.pagination }; };
