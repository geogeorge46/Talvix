import { getPreferences, resetPreferences, updatePreferences } from '../services/notificationPreference.service.js';

export const get = async (request, response, next) => { try { return response.json({ success: true, message: 'Notification preferences retrieved successfully', data: { preferences: await getPreferences(request.user.id) } }); } catch (error) { return next(error); } };
export const update = async (request, response, next) => { try { return response.json({ success: true, message: 'Notification preferences updated successfully', data: { preferences: await updatePreferences(request.user.id, request.body) } }); } catch (error) { return next(error); } };
export const reset = async (request, response, next) => { try { return response.json({ success: true, message: 'Notification preferences reset successfully', data: { preferences: await resetPreferences(request.user.id) } }); } catch (error) { return next(error); } };
