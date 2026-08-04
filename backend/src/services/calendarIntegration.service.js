import { logger } from '../shared/utils/logger.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { CalendarToken } from '../models/CalendarToken.js';
import { AuditLog } from '../models/AuditLog.js';
import { URLSearchParams } from 'node:url';

const REDIRECT_URI = process.env.CALENDAR_OAUTH_REDIRECT_URI || 'http://localhost:5000/api/v1/interviews/calendar/oauth/callback';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'mock-google-client-id';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'mock-google-client-secret';
const OUTLOOK_CLIENT_ID = process.env.OUTLOOK_CLIENT_ID || 'mock-outlook-client-id';
const OUTLOOK_CLIENT_SECRET = process.env.OUTLOOK_CLIENT_SECRET || 'mock-outlook-client-secret';

/**
 * Native, lightweight standard ICS calendar invite generation.
 */
export const exportToIcs = (schedule, roundName = 'Interview') => {
  const formatIcsDate = (date) => {
    return new Date(date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const dtstart = formatIcsDate(schedule.startTime);
  const dtend = formatIcsDate(schedule.endTime);
  const dtstamp = formatIcsDate(new Date());

  const location = schedule.mode === 'onsite'
    ? `${schedule.location?.name || ''}, ${schedule.location?.address || ''}`
    : schedule.mode === 'video'
      ? schedule.meetingUrl || ''
      : schedule.mode === 'phone'
        ? schedule.phoneDetails?.phoneNumber || ''
        : 'Virtual';

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:interview-${schedule._id || schedule.id}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:Interview: ${roundName}`,
    `DESCRIPTION:Mode: ${schedule.mode}\\nProvider: ${schedule.meetingProvider}\\nURL: ${schedule.meetingUrl || ''}`,
    `LOCATION:${location.replace(/[,;]/g, '\\$&')}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
};

/**
 * Generate OAuth url for Google / Microsoft.
 */
export const getOAuthUrl = (provider, userId, companyId) => {
  const state = `${provider}:${userId}:${companyId}`;
  if (provider === 'google') {
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent('https://www.googleapis.com/auth/calendar.events')}&access_type=offline&prompt=consent&state=${state}`;
  } else if (provider === 'outlook') {
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${OUTLOOK_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent('https://graph.microsoft.com/Calendars.ReadWrite')}&response_mode=query&state=${state}`;
  }
  throw new Error('Unsupported calendar provider');
};

/**
 * Handle OAuth code exchange.
 */
export const handleOAuthCallback = async (provider, code, userId, companyId) => {
  let tokenUrl;
  let bodyParams = new URLSearchParams({
    code,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code'
  });

  if (provider === 'google') {
    tokenUrl = 'https://oauth2.googleapis.com/token';
    bodyParams.append('client_id', GOOGLE_CLIENT_ID);
    bodyParams.append('client_secret', GOOGLE_CLIENT_SECRET);
  } else if (provider === 'outlook') {
    tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    bodyParams.append('client_id', OUTLOOK_CLIENT_ID);
    bodyParams.append('client_secret', OUTLOOK_CLIENT_SECRET);
  } else {
    throw new Error('Invalid calendar provider');
  }

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: bodyParams.toString()
  });

  if (!res.ok) {
    const errText = await res.text();
    logger.error(`[Calendar OAuth] Token exchange failed for ${provider}: ${errText}`);
    throw new Error(`Failed to exchange authorization code: ${errText}`);
  }

  const data = await res.json();
  const accessToken = encrypt(data.access_token);
  const refreshToken = data.refresh_token ? encrypt(data.refresh_token) : undefined;
  const expiryDate = new Date(Date.now() + (data.expires_in || 3600) * 1000);

  const updatedToken = await CalendarToken.findOneAndUpdate(
    { user: userId, provider },
    {
      company: companyId,
      accessToken,
      ...(refreshToken && { refreshToken }),
      expiryDate,
      status: 'active',
      errorCount: 0
    },
    { upsert: true, new: true }
  );

  return updatedToken;
};

/**
 * Get valid decrypted accessToken, refreshing if expired.
 */
export const getValidAccessToken = async (userId, provider) => {
  const tokenRecord = await CalendarToken.findOne({ user: userId, provider });
  if (!tokenRecord || tokenRecord.status === 'revoked') return null;

  if (tokenRecord.expiryDate && tokenRecord.expiryDate > new Date()) {
    return decrypt(tokenRecord.accessToken);
  }

  // Refresh token required
  if (!tokenRecord.refreshToken) {
    tokenRecord.status = 'revoked';
    await tokenRecord.save();
    return null;
  }

  let tokenUrl;
  let bodyParams = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: decrypt(tokenRecord.refreshToken)
  });

  if (provider === 'google') {
    tokenUrl = 'https://oauth2.googleapis.com/token';
    bodyParams.append('client_id', GOOGLE_CLIENT_ID);
    bodyParams.append('client_secret', GOOGLE_CLIENT_SECRET);
  } else if (provider === 'outlook') {
    tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    bodyParams.append('client_id', OUTLOOK_CLIENT_ID);
    bodyParams.append('client_secret', OUTLOOK_CLIENT_SECRET);
  }

  try {
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: bodyParams.toString()
    });

    if (!res.ok) {
      tokenRecord.errorCount += 1;
      if (tokenRecord.errorCount >= 3) {
        tokenRecord.status = 'revoked';
      }
      await tokenRecord.save();
      return null;
    }

    const data = await res.json();
    tokenRecord.accessToken = encrypt(data.access_token);
    if (data.refresh_token) {
      tokenRecord.refreshToken = encrypt(data.refresh_token);
    }
    tokenRecord.expiryDate = new Date(Date.now() + (data.expires_in || 3600) * 1000);
    tokenRecord.errorCount = 0;
    tokenRecord.status = 'active';
    await tokenRecord.save();

    return data.access_token;
  } catch (err) {
    logger.error(`[Calendar Sync] Refresh token request failed: ${err.message}`);
    tokenRecord.errorCount += 1;
    await tokenRecord.save();
    return null;
  }
};

/**
 * Synchronize event details with connected accounts.
 */
const syncToProvider = async (tokenRecord, schedule, action) => {
  const accessToken = await getValidAccessToken(tokenRecord.user, tokenRecord.provider);
  if (!accessToken) return false;

  let url = '';
  let method = 'POST';
  let body = {};

  if (tokenRecord.provider === 'google') {
    if (action === 'create') {
      url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
      method = 'POST';
      body = {
        summary: `Interview: ${schedule.mode}`,
        description: `Round details: Mode - ${schedule.mode}`,
        start: { dateTime: schedule.startTime.toISOString() },
        end: { dateTime: schedule.endTime.toISOString() }
      };
    } else if (action === 'update') {
      url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/cal-${schedule._id || schedule.id}`;
      method = 'PUT';
      body = {
        summary: `Interview: ${schedule.mode} (Rescheduled)`,
        description: `Round details: Mode - ${schedule.mode}`,
        start: { dateTime: schedule.startTime.toISOString() },
        end: { dateTime: schedule.endTime.toISOString() }
      };
    } else if (action === 'delete') {
      url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/cal-${schedule._id || schedule.id}`;
      method = 'DELETE';
    }
  } else if (tokenRecord.provider === 'outlook') {
    if (action === 'create') {
      url = 'https://graph.microsoft.com/v1.0/me/events';
      method = 'POST';
      body = {
        subject: `Interview: ${schedule.mode}`,
        body: { contentType: 'HTML', content: `Round details: Mode - ${schedule.mode}` },
        start: { dateTime: schedule.startTime.toISOString(), timeZone: 'UTC' },
        end: { dateTime: schedule.endTime.toISOString(), timeZone: 'UTC' }
      };
    } else if (action === 'update') {
      url = `https://graph.microsoft.com/v1.0/me/events/cal-${schedule._id || schedule.id}`;
      method = 'PATCH';
      body = {
        subject: `Interview: ${schedule.mode} (Rescheduled)`,
        start: { dateTime: schedule.startTime.toISOString(), timeZone: 'UTC' },
        end: { dateTime: schedule.endTime.toISOString(), timeZone: 'UTC' }
      };
    } else if (action === 'delete') {
      url = `https://graph.microsoft.com/v1.0/me/events/cal-${schedule._id || schedule.id}`;
      method = 'DELETE';
    }
  }

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      ...(method !== 'DELETE' && { body: JSON.stringify(body) })
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        tokenRecord.errorCount += 1;
        if (tokenRecord.errorCount >= 3) {
          tokenRecord.status = 'revoked';
        }
        await tokenRecord.save();
      }
      return false;
    }

    return true;
  } catch (err) {
    logger.error(`[Calendar Sync] Provider request failed: ${err.message}`);
    return false;
  }
};

export const syncCalendarEvent = async (schedule, action) => {
  const tokens = await CalendarToken.find({ user: { $in: schedule.interviewers }, status: 'active' });
  let successCount = 0;

  for (const tokenRecord of tokens) {
    const success = await syncToProvider(tokenRecord, schedule, action);
    if (success) {
      successCount++;
      await AuditLog.create({
        action: 'interview.calendar_synced',
        actor: tokenRecord.user,
        company: schedule.company,
        application: schedule.application,
        newValue: { scheduleId: schedule.id, provider: tokenRecord.provider, action }
      });
    }
  }
  return { successCount };
};

export const createCalendarEvent = async (schedule, _interviewerIds, _candidateId) => {
  logger.info(`[Calendar Sync] Creating mock event for schedule: ${schedule._id || schedule.id}`);
  await syncCalendarEvent(schedule, 'create');
  return { success: true, eventId: `cal-${schedule._id || schedule.id}` };
};

export const updateCalendarEvent = async (schedule, _interviewerIds) => {
  logger.info(`[Calendar Sync] Updating mock event for schedule: ${schedule._id || schedule.id}`);
  await syncCalendarEvent(schedule, 'update');
  return { success: true, eventId: `cal-${schedule._id || schedule.id}` };
};

export const deleteCalendarEvent = async (schedule) => {
  logger.info(`[Calendar Sync] Cancelled/Deleted mock event for schedule: ${schedule._id || schedule.id}`);
  await syncCalendarEvent(schedule, 'delete');
  return { success: true };
};
