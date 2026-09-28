import mongoose from 'mongoose';
import { Application } from '../models/Application.js';
import { Company } from '../models/Company.js';
import { CompanyMember } from '../models/CompanyMember.js';
import { InterviewAvailability } from '../models/InterviewAvailability.js';
import { InterviewProcess } from '../models/InterviewProcess.js';
import { InterviewRound } from '../models/InterviewRound.js';
import { InterviewSchedule } from '../models/InterviewSchedule.js';
import { RecruiterProfile } from '../models/RecruiterProfile.js';
import { AuditLog } from '../models/AuditLog.js';
import { AppError } from '../shared/errors/AppError.js';
import { changeApplicationStatus } from '../utils/applicationStatus.js';
import { serializeCandidateSchedule } from '../utils/interviewSerializer.js';
import { checkScheduleConflicts, normalizeTimezone, validateAvailability, validateScheduleWindow } from '../utils/interviewScheduling.js';
import { generateMeetingLink } from './meetingIntegration.service.js';
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from './calendarIntegration.service.js';
import { publishOptionalDomainEvent } from './domainEvent.service.js';
import { DOMAIN_EVENTS } from '../constants/domainEvents.js';
import { createInterviewReminders } from './reminderEvent.service.js';

const context = async (c, pid, rid) => {
  const [p, r] = await Promise.all([
    InterviewProcess.findOne({ _id: pid, company: c }),
    InterviewRound.findOne({ _id: rid, process: pid, company: c }),
  ]);
  if (!p || !r) throw new AppError('Interview round not found', 404);
  return { p, r };
};

const validateInterviewers = async (company, ids, round) => {
  const min = Math.max(1, round.minimumInterviewers ?? 1);
  const max = Math.max(min, round.maximumInterviewers ?? 10);
  if (!Array.isArray(ids) || ids.length < min || ids.length > max) {
    throw new AppError('Interviewer count is outside configured limits', 400);
  }
  const [c, companyMembers, profiles] = await Promise.all([
    Company.findById(company),
    CompanyMember.find({ company, recruiter: { $in: ids }, status: 'active' }),
    RecruiterProfile.find({ user: { $in: ids } }),
  ]);
  if (!c) throw new AppError('Company not found', 404);

  const activeUserIds = new Set();
  if (c.owner) activeUserIds.add(c.owner.toString());

  if (Array.isArray(c.teamMembers)) {
    c.teamMembers
      .filter((m) => m.status === 'active' && m.recruiter)
      .forEach((m) => activeUserIds.add(m.recruiter.toString()));
  }

  companyMembers.forEach((m) => activeUserIds.add(m.recruiter.toString()));

  profiles.forEach((p) => {
    if (p.isApproved && (p.isCompanyOwner || p.company?.toString() === company.toString())) {
      activeUserIds.add(p.user.toString());
    }
  });

  const uniqueIds = Array.from(new Set(ids));
  const isValid = uniqueIds.every((id) => activeUserIds.has(String(id)));

  if (!isValid) {
    throw new AppError('One or more interviewers are invalid', 400);
  }
};

export const scheduleRound = async (c, pid, rid, u, b) => {
  const { p, r } = await context(c, pid, rid);
  if (!['pending', 'scheduling'].includes(r.status)) {
    throw new AppError('Interview round cannot be scheduled', 409);
  }
  normalizeTimezone(b.timezone);
  const duration = validateScheduleWindow(b.startTime, b.endTime);
  if (duration !== r.durationMinutes) {
    throw new AppError('Schedule duration must match the interview round', 400);
  }
  await validateInterviewers(c, b.interviewerIds, r);

  const comp = await Company.findById(c);
  const isOwner = comp.owner.toString() === u.toString();
  if (!(isOwner && b.overrideConflicts)) {
    const conflictErr = await checkScheduleConflicts(InterviewSchedule, {
      company: c,
      candidate: p.candidate,
      interviewers: b.interviewerIds,
      startTime: b.startTime,
      endTime: b.endTime,
      location: b.location,
    });
    if (conflictErr) throw new AppError(conflictErr, 409);

    const schedStart = new Date(b.startTime);
    const startOfDay = new Date(schedStart);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(schedStart);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const availability = await InterviewAvailability.find({
      user: { $in: [p.candidate, ...b.interviewerIds] },
      date: { $gte: startOfDay, $lte: endOfDay },
    });
    if (!validateAvailability(availability, b.startTime, b.endTime)) {
      throw new AppError('Schedule is outside participant availability', 409);
    }
  }

  const sId = new mongoose.Types.ObjectId();
  let meetingUrl = b.meetingUrl;
  if (b.mode === 'video' && !meetingUrl) {
    meetingUrl = generateMeetingLink(b.meetingProvider, sId);
  }

  const s = await InterviewSchedule.create({
    _id: sId,
    ...b,
    meetingUrl,
    interviewers: b.interviewerIds,
    process: p.id,
    round: r.id,
    application: p.application,
    candidate: p.candidate,
    job: p.job,
    company: c,
    scheduledBy: u,
    durationMinutes: duration,
  });

  r.status = 'scheduled';
  r.interviewers = b.interviewerIds;
  r.scheduledInterview = s.id;
  p.status = 'active';
  p.startedAt ??= new Date();
  p.currentRound = r.id;



  await Promise.all([
    r.save(),
    p.save(),
    createCalendarEvent(s, b.interviewerIds, p.candidate),
    createInterviewReminders(s, b.interviewerIds),
  ]);

  await AuditLog.create({
    action: 'interview.created',
    actor: u,
    company: c,
    application: p.application,
    newValue: { scheduleId: s.id, startTime: s.startTime, endTime: s.endTime },
    ipAddress: b.ipAddress || 'Unknown',
    userAgent: b.userAgent || 'Unknown',
  });

  return s;
};

export const respond = async (candidate, id, b) => {
  const s = await InterviewSchedule.findOne({
    _id: id,
    candidate,
    status: { $in: ['scheduled', 'proposed', 'confirmed', 'reschedule-requested', 'rescheduled'] },
  });
  if (!s) throw new AppError('Interview schedule not found', 404);
  if (s.startTime <= new Date()) throw new AppError('This interview has already started', 409);

  s.candidateResponse = b.response;
  s.candidateResponseAt = new Date();

  let eventType = DOMAIN_EVENTS.INTERVIEW_UPDATED;

  if (b.response === 'accepted') {
    s.status = 'confirmed';
    eventType = DOMAIN_EVENTS.INTERVIEW_CANDIDATE_ACCEPTED;
    const app = await Application.findById(s.application);
    if (app && ['shortlisted', 'assessment-completed'].includes(app.status)) {
      changeApplicationStatus(app, 'interview-scheduled', candidate, 'Candidate confirmed interview');
      await app.save();
    }
  } else if (b.response === 'reschedule-requested') {
    s.status = 'reschedule-requested';
    s.rescheduleRequest = {
      requestedBy: candidate,
      reason: b.reason,
      preferredSlots: b.preferredSlots,
      requestedAt: new Date(),
    };
    eventType = DOMAIN_EVENTS.INTERVIEW_RESCHEDULE_REQUESTED;
  } else if (b.response === 'declined') {
    s.status = 'cancelled';
    s.cancellation = {
      cancelledBy: candidate,
      reason: b.reason || 'Candidate declined',
      cancelledAt: new Date(),
    };
    eventType = DOMAIN_EVENTS.INTERVIEW_CANCELLED;
    const app = await Application.findById(s.application);
    if (app && app.status === 'interview-scheduled') {
      changeApplicationStatus(app, 'shortlisted', candidate, 'Interview declined by candidate', { adminOverride: true });
      await app.save();
    }
    await deleteCalendarEvent(s);
  }

  s.audit.push({ action: `candidate-${b.response}`, actor: candidate, reason: b.reason, at: new Date() });
  await s.save();

  await publishOptionalDomainEvent({
    type: eventType,
    actor: String(candidate),
    company: String(s.company),
    recipientIds: [...s.interviewers.map(String), String(s.scheduledBy)],
    payload: {
      scheduleId: String(s.id),
      processId: String(s.process),
      candidateId: String(candidate),
      status: s.status,
      reason: b.reason,
    },
    deduplicationKey: `${eventType}:${s.id}:${s.version}`,
  });

  await AuditLog.create({
    action: b.response === 'declined' ? 'interview.cancelled' : 'interview.updated',
    actor: candidate,
    company: s.company,
    application: s.application,
    newValue: { scheduleId: s.id, response: b.response, reason: b.reason },
    ipAddress: b.ipAddress || 'Unknown',
    userAgent: b.userAgent || 'Unknown',
  });

  return serializeCandidateSchedule(s);
};

export const getMySchedule = async (candidate, id) => {
  const s = await InterviewSchedule.findOne({ _id: id, candidate });
  if (!s) throw new AppError('Interview schedule not found', 404);
  return serializeCandidateSchedule(s);
};

export const rescheduleRound = async (c, pid, rid, u, b) => {
  const { r } = await context(c, pid, rid);
  const s =
    (r.scheduledInterview
      ? await InterviewSchedule.findOne({ _id: r.scheduledInterview, company: c })
      : null) ||
    (await InterviewSchedule.findOne({ round: r.id, company: c }).sort({
      version: -1,
      createdAt: -1,
    }));
  if (!s || !['scheduled', 'proposed', 'confirmed', 'reschedule-requested', 'rescheduled'].includes(s.status)) {
    throw new AppError('Interview schedule cannot be rescheduled', 409);
  }

  const interviewers = b.interviewerIds ?? s.interviewers.map(String);
  normalizeTimezone(b.timezone);
  const duration = validateScheduleWindow(b.startTime, b.endTime);
  if (duration !== r.durationMinutes) {
    throw new AppError('Schedule duration must match the interview round', 400);
  }
  await validateInterviewers(c, interviewers, r);

  const comp = await Company.findById(c);
  const isOwner = comp.owner.toString() === u.toString();
  if (!(isOwner && b.overrideConflicts)) {
    const conflictErr = await checkScheduleConflicts(InterviewSchedule, {
      company: c,
      candidate: s.candidate,
      interviewers,
      startTime: b.startTime,
      endTime: b.endTime,
      location: b.location,
      excludeId: s.id,
    });
    if (conflictErr) throw new AppError(conflictErr, 409);

    const schedStart = new Date(b.startTime);
    const startOfDay = new Date(schedStart);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(schedStart);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const availability = await InterviewAvailability.find({
      user: { $in: [s.candidate, ...interviewers] },
      date: { $gte: startOfDay, $lte: endOfDay },
    });
    if (!validateAvailability(availability, b.startTime, b.endTime)) {
      throw new AppError('Schedule is outside participant availability', 409);
    }
  }

  s.previousSchedules.push({
    startTime: s.startTime,
    endTime: s.endTime,
    timezone: s.timezone,
    mode: s.mode,
    meetingProvider: s.meetingProvider,
    meetingUrl: s.meetingUrl,
    meetingId: s.meetingId,
    location: s.location,
    changedBy: u,
    reason: b.reason,
  });

  s.rescheduleHistory.push({
    previousScheduledAt: s.scheduledAt || s.startTime,
    newScheduledAt: new Date(b.startTime),
    changedBy: u,
    reason: b.reason || 'Rescheduled',
    changedAt: new Date()
  });

  let meetingUrl = b.meetingUrl;
  if (b.mode === 'video' && !meetingUrl) {
    meetingUrl = generateMeetingLink(b.meetingProvider, s.id);
  }

  s.set({
    ...b,
    meetingUrl,
    interviewers,
    durationMinutes: duration,
    status: 'rescheduled',
    candidateResponse: 'pending',
    candidateResponseAt: null,
    version: s.version + 1,
  });

  r.status = 'scheduled';
  r.interviewers = interviewers;
  r.scheduledInterview = s.id;

  await Promise.all([
    s.save(),
    r.save(),
    updateCalendarEvent(s, interviewers),
    createInterviewReminders(s, interviewers),
  ]);

  await publishOptionalDomainEvent({
    type: DOMAIN_EVENTS.INTERVIEW_RESCHEDULED,
    actor: String(u),
    company: String(c),
    recipientIds: [String(s.candidate)],
    payload: {
      scheduleId: String(s.id),
      processId: String(s.process),
      startTime: s.startTime,
      endTime: s.endTime,
      timezone: s.timezone,
    },
    deduplicationKey: `${DOMAIN_EVENTS.INTERVIEW_RESCHEDULED}:${s.id}:${s.version}`,
  });

  await AuditLog.create({
    action: 'interview.rescheduled',
    actor: u,
    company: c,
    application: s.application,
    newValue: { scheduleId: s.id, startTime: s.startTime, endTime: s.endTime, version: s.version },
    ipAddress: b.ipAddress || 'Unknown',
    userAgent: b.userAgent || 'Unknown',
  });

  return s;
};

export const cancelRound = async (c, pid, rid, u, reason) => {
  const { r } = await context(c, pid, rid);
  if (['completed', 'cancelled'].includes(r.status)) {
    throw new AppError('Interview round cannot be cancelled', 409);
  }
  r.status = 'cancelled';
  r.cancelledAt = new Date();
  r.cancellationReason = reason;

  const s = await InterviewSchedule.findById(r.scheduledInterview);
  if (s) {
    s.status = 'cancelled';
    s.cancellation = { cancelledBy: u, reason, cancelledAt: new Date() };

    const app = await Application.findById(s.application);
    if (app && app.status === 'interview-scheduled') {
      changeApplicationStatus(app, 'shortlisted', u, 'Interview cancelled', { adminOverride: true });
      await app.save();
    }

    await Promise.all([
      s.save(),
      deleteCalendarEvent(s),
    ]);

    await publishOptionalDomainEvent({
      type: DOMAIN_EVENTS.INTERVIEW_CANCELLED,
      actor: String(u),
      company: String(c),
      recipientIds: [String(s.candidate)],
      payload: {
        scheduleId: String(s.id),
        processId: String(s.process),
        reason,
      },
      deduplicationKey: `${DOMAIN_EVENTS.INTERVIEW_CANCELLED}:${s.id}:${s.version}`,
    });

    await AuditLog.create({
      action: 'interview.cancelled',
      actor: u,
      company: c,
      application: s.application,
      newValue: { scheduleId: s.id, reason },
    });
  }

  await r.save();
  return r;
};

export const markNoShow = async (c, pid, rid, u, b) => {
  const { r } = await context(c, pid, rid);
  const s = await InterviewSchedule.findById(r.scheduledInterview);
  if (!s || s.startTime > new Date()) {
    throw new AppError('No-show can only be recorded after interview start', 409);
  }
  s.status = 'no-show';
  r.status = 'no-show';
  r.noShow = { ...b, recordedBy: u, recordedAt: new Date() };

  await Promise.all([s.save(), r.save()]);

  await publishOptionalDomainEvent({
    type: DOMAIN_EVENTS.INTERVIEW_NO_SHOW,
    actor: String(u),
    company: String(c),
    recipientIds: [String(s.candidate)],
    payload: {
      scheduleId: String(s.id),
      processId: String(s.process),
    },
    deduplicationKey: `${DOMAIN_EVENTS.INTERVIEW_NO_SHOW}:${s.id}`,
  });

  await AuditLog.create({
    action: 'interview.updated',
    actor: u,
    company: c,
    application: s.application,
    newValue: { scheduleId: s.id, status: 'no-show' },
    ipAddress: b.ipAddress || 'Unknown',
    userAgent: b.userAgent || 'Unknown',
  });

  return r;
};

export const getScheduleDetails = async (scheduleId, user) => {
  const s = await InterviewSchedule.findById(scheduleId)
    .populate('candidate', 'fullName email')
    .populate('interviewers', 'fullName email')
    .populate('job', 'title')
    .populate('company', 'name slug');
  if (!s) throw new AppError('Interview schedule not found', 404, { code: 'INTERVIEW_NOT_FOUND' });

  const userId = String(user.id);
  const isCandidate = String(s.candidate._id || s.candidate) === userId;
  let isInterviewer = (s.interviewers || []).some((i) => String(i._id || i) === userId);

  if (!isInterviewer && user.role === 'recruiter') {
    const comp = await Company.findById(s.company);
    const member = comp?.teamMembers?.find(
      (m) => String(m.recruiter) === userId && m.status === 'active'
    );
    if (member) isInterviewer = true;
  }

  if (!isCandidate && !isInterviewer && user.role !== 'admin') {
    throw new AppError('Access denied to this interview', 403, { code: 'INTERVIEW_UNAUTHORIZED' });
  }

  const now = new Date();
  const schedTime = s.scheduledAt || s.startTime;
  const endTime = s.endsAt || s.endTime;
  const win = s.joinWindowMinutes || 5;
  const joinAvailableAt = s.joinAvailableAt || new Date(new Date(schedTime).getTime() - win * 60 * 1000);

  const isTerminal = ['completed', 'cancelled', 'expired'].includes(s.status);
  const graceEndTime = new Date(new Date(endTime).getTime() + 24 * 60 * 60 * 1000);
  const canEnterWaitingRoom = now >= joinAvailableAt && now < graceEndTime && !isTerminal;
  const canStart = now >= schedTime && now < graceEndTime && !isTerminal;

  return {
    id: String(s._id),
    scheduleId: String(s._id),
    processId: String(s.process),
    roundId: String(s.round),
    applicationId: String(s.application),
    candidate: s.candidate,
    interviewers: s.interviewers,
    job: s.job,
    company: s.company,
    scheduledAt: schedTime,
    startTime: schedTime,
    endsAt: endTime,
    endTime: endTime,
    joinAvailableAt,
    joinWindowMinutes: win,
    durationMinutes: s.durationMinutes,
    timezone: s.timezone,
    status: s.status,
    candidateResponse: s.candidateResponse,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    completedAt: s.completedAt,
    candidateJoinedAt: s.candidateJoinedAt,
    interviewerJoinedAt: s.interviewerJoinedAt,
    rescheduleHistory: s.rescheduleHistory || [],
    canEnterWaitingRoom,
    canStart,
    serverTime: now.toISOString()
  };
};

export const startInterviewSchedule = async (scheduleId, user) => {
  const s = await InterviewSchedule.findById(scheduleId);
  if (!s) throw new AppError('Interview schedule not found', 404, { code: 'INTERVIEW_NOT_FOUND' });

  const userId = String(user.id);
  const isCandidate = String(s.candidate) === userId;
  let isInterviewer = (s.interviewers || []).map(String).includes(userId);

  if (!isInterviewer && user.role === 'recruiter') {
    const comp = await Company.findById(s.company);
    const member = comp?.teamMembers?.find(
      (m) => String(m.recruiter) === userId && m.status === 'active'
    );
    if (member) isInterviewer = true;
  }

  if (!isCandidate && !isInterviewer && user.role !== 'admin') {
    throw new AppError('Access denied', 403, { code: 'INTERVIEW_UNAUTHORIZED' });
  }

  if (['completed'].includes(s.status)) {
    throw new AppError('Interview has already been completed', 409, { code: 'INTERVIEW_COMPLETED' });
  }
  if (['cancelled'].includes(s.status)) {
    throw new AppError('Interview was cancelled', 409, { code: 'INTERVIEW_CANCELLED' });
  }
  if (['expired'].includes(s.status)) {
    throw new AppError('Interview has expired', 403, { code: 'INTERVIEW_EXPIRED' });
  }

  const now = new Date();
  const schedTime = s.scheduledAt || s.startTime;
  const endTime = s.endsAt || s.endTime;
  const win = s.joinWindowMinutes || 5;
  const joinAvailableAt = s.joinAvailableAt || new Date(new Date(schedTime).getTime() - win * 60 * 1000);

  if (now < joinAvailableAt) {
    throw new AppError('Interview window is not open yet', 403, { code: 'INTERVIEW_NOT_OPEN' });
  }

  const graceEndTime = new Date(new Date(endTime).getTime() + 24 * 60 * 60 * 1000);
  if (now >= graceEndTime) {
    s.status = 'expired';
    await s.save();
    throw new AppError('Interview window has expired', 403, { code: 'INTERVIEW_EXPIRED' });
  }

  if (now < schedTime) {
    if (['scheduled', 'proposed', 'confirmed', 'rescheduled'].includes(s.status)) {
      s.status = 'waiting_room';
      await s.save();
    }
    return {
      status: s.status,
      canEnterWaitingRoom: true,
      canStart: false,
      scheduledAt: schedTime,
      serverTime: now.toISOString()
    };
  }

  if (['scheduled', 'proposed', 'confirmed', 'rescheduled', 'waiting_room', 'in_progress'].includes(s.status)) {
    s.status = 'in_progress';
    s.startedAt ??= now;
    if (isCandidate) s.candidateJoinedAt ??= now;
    if (isInterviewer) s.interviewerJoinedAt ??= now;
    await s.save();

    await InterviewRound.updateOne(
      { _id: s.round },
      { $set: { status: 'in-progress', startedAt: now } }
    );
  }

  return {
    status: s.status,
    canEnterWaitingRoom: true,
    canStart: true,
    startedAt: s.startedAt,
    scheduledAt: schedTime,
    endsAt: endTime,
    serverTime: now.toISOString()
  };
};

export const endInterviewSchedule = async (scheduleId, user) => {
  const s = await InterviewSchedule.findById(scheduleId);
  if (!s) throw new AppError('Interview schedule not found', 404, { code: 'INTERVIEW_NOT_FOUND' });

  const userId = String(user.id);
  const isCandidate = String(s.candidate) === userId;
  let isInterviewer = (s.interviewers || []).map(String).includes(userId);

  if (!isInterviewer && user.role === 'recruiter') {
    const comp = await Company.findById(s.company);
    const member = comp?.teamMembers?.find(
      (m) => String(m.recruiter) === userId && m.status === 'active'
    );
    if (member) isInterviewer = true;
  }

  if (!isCandidate && !isInterviewer && user.role !== 'admin') {
    throw new AppError('Access denied', 403, { code: 'INTERVIEW_UNAUTHORIZED' });
  }

  const now = new Date();
  s.status = 'completed';
  s.endedAt = now;
  s.completedAt = now;
  await s.save();

  await InterviewRound.updateOne(
    { _id: s.round },
    { $set: { status: 'awaiting-feedback', completedAt: now } }
  );

  return {
    status: s.status,
    endedAt: s.endedAt,
    completedAt: s.completedAt
  };
};

export const joinMeeting = async (id, u, reqMeta = {}) => {
  const s = await InterviewSchedule.findById(id);
  if (!s) throw new AppError('Interview schedule not found', 404);

  if (u.role === 'recruiter') {
    const comp = await Company.findById(s.company);
    const member = comp?.teamMembers.find(
      (m) => m.recruiter.toString() === u.id && m.status === 'active'
    );
    if (!member) throw new AppError('Access denied', 403);
  } else if (u.role === 'candidate') {
    if (s.candidate.toString() !== u.id) {
      throw new AppError('Access denied', 403);
    }
  } else if (u.role !== 'admin') {
    throw new AppError('Access denied', 403);
  }

  await AuditLog.create({
    action: 'interview.meeting_joined',
    actor: u.id,
    company: s.company,
    application: s.application,
    newValue: { scheduleId: s.id },
    ipAddress: reqMeta.ipAddress || 'Unknown',
    userAgent: reqMeta.userAgent || 'Unknown',
  });

  return { success: true };
};

export const leaveMeeting = async (id, u, reqMeta = {}) => {
  const s = await InterviewSchedule.findById(id);
  if (!s) throw new AppError('Interview schedule not found', 404);

  if (u.role === 'recruiter') {
    const comp = await Company.findById(s.company);
    const member = comp?.teamMembers.find(
      (m) => m.recruiter.toString() === u.id && m.status === 'active'
    );
    if (!member) throw new AppError('Access denied', 403);
  } else if (u.role === 'candidate') {
    if (s.candidate.toString() !== u.id) {
      throw new AppError('Access denied', 403);
    }
  } else if (u.role !== 'admin') {
    throw new AppError('Access denied', 403);
  }

  await AuditLog.create({
    action: 'interview.meeting_left',
    actor: u.id,
    company: s.company,
    application: s.application,
    newValue: { scheduleId: s.id },
    ipAddress: reqMeta.ipAddress || 'Unknown',
    userAgent: reqMeta.userAgent || 'Unknown',
  });

  return { success: true };
};


