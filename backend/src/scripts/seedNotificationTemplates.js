import { pathToFileURL } from 'node:url';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { NOTIFICATION_TYPES } from '../constants/notification.js';
import { NotificationTemplate } from '../models/NotificationTemplate.js';

export const seedNotificationTemplates = async () => {
  const operations = NOTIFICATION_TYPES.flatMap((type) => [
    { key: `system-${type}-in-app`, type, channel: 'in-app', name: `${type} in-app`, title: 'Talvix update', body: 'You have a new Talvix update.', variables: [], locale: 'en', version: 1, isActive: true, isSystem: true },
    { key: `system-${type}-email`, type, channel: 'email', name: `${type} email`, subject: 'Talvix update', body: '<p>You have a new Talvix update.</p>', variables: [], locale: 'en', version: 1, isActive: true, isSystem: true },
  ]).map((template) => ({ updateOne: { filter: { key: template.key, locale: 'en', version: 1 }, update: { $setOnInsert: template }, upsert: true } }));
  const result = await NotificationTemplate.bulkWrite(operations, { ordered: false });
  return { inserted: result.upsertedCount, existing: operations.length - result.upsertedCount };
};

const run = async () => { try { await connectDatabase(); const result = await seedNotificationTemplates(); console.info(`Notification templates ready: ${result.inserted} inserted, ${result.existing} existing`); } finally { await disconnectDatabase(); } };
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run().catch((error) => { console.error('Notification template seed failed:', error.message); process.exitCode = 1; });
