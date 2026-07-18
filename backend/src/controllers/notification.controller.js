import * as inbox from '../services/notificationInbox.service.js';

const handler = (operation) => async (request, response, next) => { try { return await operation(request, response); } catch (error) { return next(error); } };
export const list = handler(async (request, response) => response.json({ success: true, message: 'Notifications retrieved successfully', data: await inbox.list(request.user.id, request.validatedQuery) }));
export const get = handler(async (request, response) => response.json({ success: true, message: 'Notification retrieved successfully', data: { notification: await inbox.get(request.user.id, request.params.notificationId) } }));
const state = (field, value, message) => handler(async (request, response) => response.json({ success: true, message, data: { notification: await inbox.state(request.user.id, request.params.notificationId, field, value) } }));
export const markRead = state('read', true, 'Notification marked as read');
export const markUnread = state('read', false, 'Notification marked as unread');
export const archive = state('archived', true, 'Notification archived successfully');
export const unarchive = state('archived', false, 'Notification unarchived successfully');
export const remove = state('archived', true, 'Notification removed successfully');
export const readAll = handler(async (request, response) => { await inbox.all(request.user.id, 'read'); return response.json({ success: true, message: 'All notifications marked as read' }); });
export const archiveAll = handler(async (request, response) => { await inbox.all(request.user.id, 'archived'); return response.json({ success: true, message: 'All notifications archived successfully' }); });
const bulk = (field, message) => handler(async (request, response) => { const result = await inbox.bulk(request.user.id, request.body.notificationIds, field); return response.json({ success: true, message, data: { modifiedCount: result.modifiedCount } }); });
export const bulkRead = bulk('read', 'Notifications marked as read');
export const bulkArchive = bulk('archived', 'Notifications archived successfully');
export const unreadCount = handler(async (request, response) => response.json({ success: true, message: 'Unread notification count retrieved successfully', data: await inbox.counts(request.user.id) }));
