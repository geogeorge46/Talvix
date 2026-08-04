import * as x from '../services/interviewWorkflow.service.js';
import { InterviewSchedule } from '../models/InterviewSchedule.js';
import { exportToIcs, getOAuthUrl, handleOAuthCallback } from '../services/calendarIntegration.service.js';
import { joinMeeting as joinMeetingService, leaveMeeting as leaveMeetingService } from '../services/interviewSchedule.service.js';
import { InterviewRound } from '../models/InterviewRound.js';
import { Company } from '../models/Company.js';
import { AppError } from '../shared/errors/AppError.js';

const h = (f) => async (r, s, n) => {
  try {
    return await f(r, s);
  } catch (e) {
    return n(e);
  }
};

export const downloadIcs = h(async (r, s) => {
  const schedule = await InterviewSchedule.findById(r.params.scheduleId);
  if (!schedule) throw new AppError('Interview schedule not found', 404);

  if (r.user.role === 'recruiter') {
    const company = await Company.findById(schedule.company);
    if (!company) throw new AppError('Company not found', 404);
    const member = company.teamMembers.find(
      (m) => m.recruiter.toString() === r.user.id && m.status === 'active'
    );
    if (!member) throw new AppError('Access denied', 403);
  } else if (r.user.role === 'candidate') {
    if (schedule.candidate.toString() !== r.user.id) {
      throw new AppError('Access denied', 403);
    }
  } else if (r.user.role !== 'admin') {
    throw new AppError('Access denied', 403);
  }

  const round = await InterviewRound.findById(schedule.round);
  const icsString = exportToIcs(schedule, round?.name || 'Interview');

  s.setHeader('Content-Type', 'text/calendar');
  s.setHeader('Content-Disposition', `attachment; filename=interview-${r.params.scheduleId}.ics`);
  return s.send(icsString);
});

export const schedule = h(async (r, s) => {
  r.body.ipAddress = r.ip;
  r.body.userAgent = r.headers['user-agent'];
  return s.status(201).json({
    success: true,
    message: 'Interview scheduled successfully',
    data: { schedule: await x.scheduleRound(r.company.id, r.params.processId, r.params.roundId, r.user.id, r.body) }
  });
});

export const respond = h(async (r, s) => {
  r.body.ipAddress = r.ip;
  r.body.userAgent = r.headers['user-agent'];
  return s.json({
    success: true,
    message: `Interview invitation ${r.body.response} successfully`,
    data: { schedule: await x.respond(r.user.id, r.params.scheduleId, r.body) }
  });
});

export const mySchedule = h(async (r, s) => {
  return s.json({
    success: true,
    message: 'Interview schedule retrieved successfully',
    data: { schedule: await x.getMySchedule(r.user.id, r.params.scheduleId) }
  });
});

export const reschedule = h(async (r, s) => {
  r.body.ipAddress = r.ip;
  r.body.userAgent = r.headers['user-agent'];
  return s.json({
    success: true,
    message: 'Interview rescheduled successfully',
    data: { schedule: await x.rescheduleRound(r.company.id, r.params.processId, r.params.roundId, r.user.id, r.body) }
  });
});

export const cancel = h(async (r, s) => {
  return s.json({
    success: true,
    message: 'Interview round cancelled successfully',
    data: { round: await x.cancelRound(r.company.id, r.params.processId, r.params.roundId, r.user.id, r.body.reason) }
  });
});

export const noShow = h(async (r, s) => {
  r.body.ipAddress = r.ip;
  r.body.userAgent = r.headers['user-agent'];
  return s.json({
    success: true,
    message: 'Interview no-show recorded successfully',
    data: { round: await x.markNoShow(r.company.id, r.params.processId, r.params.roundId, r.user.id, r.body) }
  });
});

export const connectCalendar = h(async (r, s) => {
  const { provider } = r.params;
  const url = getOAuthUrl(provider, r.user.id, r.company.id);
  return s.redirect(url);
});

export const handleCallback = h(async (r, s) => {
  const { code, state } = r.query;
  if (!code || !state) {
    throw new AppError('Authorization code or state is missing', 400);
  }

  const [provider, userId, companyId] = state.split(':');
  if (!provider || !userId || !companyId) {
    throw new AppError('Invalid state parameter', 400);
  }

  await handleOAuthCallback(provider, code, userId, companyId);

  s.setHeader('Content-Type', 'text/html');
  return s.send(`
    <html>
      <body style="font-family: sans-serif; text-align: center; padding-top: 100px;">
        <h2>Calendar connected successfully!</h2>
        <p>You can close this tab now.</p>
        <script>
          setTimeout(() => { window.close(); }, 3000);
        </script>
      </body>
    </html>
  `);
});

export const joinMeeting = h(async (r, s) => {
  const reqMeta = { ipAddress: r.ip, userAgent: r.headers['user-agent'] };
  await joinMeetingService(r.params.scheduleId, r.user, reqMeta);
  return s.json({ success: true, message: 'Meeting joined successfully' });
});

export const leaveMeeting = h(async (r, s) => {
  const reqMeta = { ipAddress: r.ip, userAgent: r.headers['user-agent'] };
  await leaveMeetingService(r.params.scheduleId, r.user, reqMeta);
  return s.json({ success: true, message: 'Meeting left successfully' });
});
