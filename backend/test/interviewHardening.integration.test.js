import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { Application } from '../src/models/Application.js';
import { Company } from '../src/models/Company.js';
import { InterviewFeedback } from '../src/models/InterviewFeedback.js';
import { InterviewProcess } from '../src/models/InterviewProcess.js';
import { InterviewRound } from '../src/models/InterviewRound.js';
import { InterviewSchedule } from '../src/models/InterviewSchedule.js';
import { InterviewTemplate } from '../src/models/InterviewTemplate.js';
import { RecruiterProfile } from '../src/models/RecruiterProfile.js';
import { CalendarToken } from '../src/models/CalendarToken.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { User } from '../src/models/User.js';
import { Job } from '../src/models/Job.js';
import { generateAccessToken } from '../src/utils/jwt.js';

let db;
let seq = 0;
const permissions = ['interviews.view', 'interviews.manage', 'interviews.schedule', 'interviews.evaluate'];
const api = (m, p, t) => request(app)[m](p).set('Authorization', `Bearer ${t}`);

const user = async (role) => {
  seq++;
  const u = await User.create({
    fullName: `${role} ${seq}`,
    email: `${role}${seq}@hardening.test`,
    password: 'Strong!Pass123',
    role,
  });
  return { user: u, token: generateAccessToken(u.id) };
};

const recruiter = async () => {
  const a = await user('recruiter');
  const company = await Company.create({
    name: `Company ${seq}`,
    slug: `company-${seq}`,
    owner: a.user.id,
    verificationStatus: 'verified',
    isActive: true,
    teamMembers: [{ recruiter: a.user.id, role: 'owner', permissions, status: 'active' }],
    interviewReminderPolicy: ['24h', '2h', '30m']
  });
  await RecruiterProfile.create({
    user: a.user.id,
    company: company.id,
    isApproved: true,
    isCompanyOwner: true,
    permissions,
  });
  return { ...a, company };
};

const templateBody = {
  name: 'Engineering interview',
  rounds: [
    {
      name: 'Technical',
      type: 'technical',
      durationMinutes: 60,
      order: 0,
      required: true,
      minimumInterviewers: 1,
      maximumInterviewers: 2,
      scorecardTemplate: {
        criteria: [
          {
            id: 'node',
            name: 'Node.js',
            category: 'technical',
            weight: 2,
            maximumScore: 5,
            required: true,
          },
          {
            id: 'design',
            name: 'System Design',
            category: 'problem-solving',
            weight: 3,
            maximumScore: 5,
            required: true,
          }
        ],
      },
    },
  ],
};

const application = async (o, c, job = new mongoose.Types.ObjectId()) =>
  Application.create({
    candidate: c.user.id,
    candidateProfile: new mongoose.Types.ObjectId(),
    job,
    company: o.company.id,
    applicationNumber: `TVX-HRD-${seq}-${Date.now()}`,
    status: 'shortlisted',
    candidateSnapshot: { fullName: c.user.fullName },
    jobSnapshot: { title: 'Engineer' },
    skillMatch: {
      score: 0,
      matchedSkills: [],
      missingRequiredSkills: [],
      breakdown: [],
    },
  });

beforeAll(async () => {
  db = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(db.getUri());
  await Promise.all([
    User.init(),
    Company.init(),
    RecruiterProfile.init(),
    Application.init(),
    InterviewTemplate.init(),
    InterviewProcess.init(),
    InterviewRound.init(),
    InterviewSchedule.init(),
    InterviewFeedback.init(),
    CalendarToken.init(),
    AuditLog.init(),
    Job.init(),
  ]);
});

beforeEach(async () =>
  Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})))
);

afterAll(async () => {
  await mongoose.disconnect();
  await db.stop();
});

describe('Interview Management Hardening tests', () => {
  it('should enforce conflict checks, room booking collisions, and support overrides', async () => {
    const owner = await recruiter();
    const cand1 = await user('candidate');
    const cand2 = await user('candidate');
    
    const app1 = await application(owner, cand1);
    const app2 = await application(owner, cand2);

    const t = await api('post', '/api/v1/interviews/templates', owner.token)
      .send(templateBody)
      .expect(201);
    
    const p1 = await api('post', '/api/v1/interviews/processes', owner.token)
      .send({ applicationId: app1.id, templateId: t.body.data.template._id })
      .expect(201);
    
    const p2 = await api('post', '/api/v1/interviews/processes', owner.token)
      .send({ applicationId: app2.id, templateId: t.body.data.template._id })
      .expect(201);

    const r1 = p1.body.data.process.rounds[0];
    const r2 = p2.body.data.process.rounds[0];

    const start = new Date(Date.now() + 3600000);
    const end = new Date(start.getTime() + 3600000);

    // Schedule R1
    await api('post', `/api/v1/interviews/processes/manage/${p1.body.data.process._id}/rounds/${r1}/schedule`, owner.token)
      .send({
        interviewerIds: [owner.user.id],
        timezone: 'UTC',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        mode: 'onsite',
        meetingProvider: 'onsite',
        location: {
          name: 'Conference Room Alpha',
          address: 'Talvix HQ Office 3'
        }
      })
      .expect(201);

    // Schedule R2 conflicting interviewer + room
    const conflictRes = await api('post', `/api/v1/interviews/processes/manage/${p2.body.data.process._id}/rounds/${r2}/schedule`, owner.token)
      .send({
        interviewerIds: [owner.user.id],
        timezone: 'UTC',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        mode: 'onsite',
        meetingProvider: 'onsite',
        location: {
          name: 'Conference Room Alpha',
          address: 'Talvix HQ Office 3'
        }
      })
      .expect(409);
    expect(conflictRes.body.message).toContain('interviewer');

    // Bypass conflict with Primary Admin Override
    const overrideRes = await api('post', `/api/v1/interviews/processes/manage/${p2.body.data.process._id}/rounds/${r2}/schedule`, owner.token)
      .send({
        interviewerIds: [owner.user.id],
        timezone: 'UTC',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        mode: 'onsite',
        meetingProvider: 'onsite',
        location: {
          name: 'Conference Room Alpha',
          address: 'Talvix HQ Office 3'
        },
        overrideConflicts: true
      })
      .expect(201);
    expect(overrideRes.body.success).toBe(true);
  });

  it('should support template versioning', async () => {
    const owner = await recruiter();
    const t = await api('post', '/api/v1/interviews/templates', owner.token)
      .send(templateBody)
      .expect(201);
    
    expect(t.body.data.template.version).toBe(1);

    const updated = await api('patch', `/api/v1/interviews/templates/${t.body.data.template._id}`, owner.token)
      .send({ name: 'Engineering interview v2' })
      .expect(200);
    
    expect(updated.body.data.template.version).toBe(2);
  });

  it('should enforce multi-interviewer isolation and visibility rules', async () => {
    const owner = await recruiter();
    const secondInterviewer = await user('recruiter');
    // Add second recruiter to team members
    owner.company.teamMembers.push({ recruiter: secondInterviewer.user.id, role: 'member', permissions, status: 'active' });
    await owner.company.save();
    await RecruiterProfile.create({
      user: secondInterviewer.user.id,
      company: owner.company.id,
      isApproved: true,
      permissions
    });

    const job = await Job.create({
      company: owner.company.id,
      title: 'Senior Engineer',
      hiringManager: secondInterviewer.user.id,
      description: 'Test job description',
      employmentType: 'full-time',
      workMode: 'hybrid',
      slug: `senior-engineer-${Date.now()}`,
      createdBy: owner.user.id,
      status: 'published'
    });

    const cand = await user('candidate');
    const app = await application(owner, cand, job.id);

    const customTemplate = {
      ...templateBody,
      rounds: [
        {
          ...templateBody.rounds[0],
          minimumInterviewers: 2,
          maximumInterviewers: 2
        }
      ]
    };

    const t = await api('post', '/api/v1/interviews/templates', owner.token)
      .send(customTemplate)
      .expect(201);

    const p = await api('post', '/api/v1/interviews/processes', owner.token)
      .send({ applicationId: app.id, templateId: t.body.data.template._id })
      .expect(201);

    const r = p.body.data.process.rounds[0];

    const start = new Date(Date.now() + 3600000);
    const end = new Date(start.getTime() + 3600000);

    // Schedule round with 2 interviewers
    await api('post', `/api/v1/interviews/processes/manage/${p.body.data.process._id}/rounds/${r}/schedule`, owner.token)
      .send({
        interviewerIds: [owner.user.id, secondInterviewer.user.id],
        timezone: 'UTC',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        mode: 'video',
        meetingProvider: 'google-meet'
      })
      .expect(201);

    // Start round
    await api('patch', `/api/v1/interviews/processes/manage/${p.body.data.process._id}/rounds/${r}/start`, owner.token).expect(200);

    // Owner saves own scorecard draft
    await api('put', `/api/v1/interviews/feedback/${r}/me`, owner.token)
      .send({
        scores: [
          { criterionId: 'node', score: 4 },
          { criterionId: 'design', score: 3 }
        ],
        recommendation: 'hire'
      })
      .expect(200);

    // Hiring manager (secondInterviewer) saves draft
    await api('put', `/api/v1/interviews/feedback/${r}/me`, secondInterviewer.token)
      .send({
        scores: [
          { criterionId: 'node', score: 5 },
          { criterionId: 'design', score: 4 }
        ],
        recommendation: 'strong-hire'
      })
      .expect(200);

    // Submit both scorecards
    await api('post', `/api/v1/interviews/feedback/${r}/me/submit`, owner.token).expect(200);
    await api('post', `/api/v1/interviews/feedback/${r}/me/submit`, secondInterviewer.token).expect(200);

    // Normal interviewer tries to view all feedback (restricted!)
    // Wait, the owner is owner/owner but let's check: owner has role owner, so owner sees all.
    // What if a third recruiter tries to view round feedback?
    const thirdRecruiter = await user('recruiter');
    owner.company.teamMembers.push({ recruiter: thirdRecruiter.user.id, role: 'member', permissions, status: 'active' });
    await owner.company.save();
    await RecruiterProfile.create({
      user: thirdRecruiter.user.id,
      company: owner.company.id,
      isApproved: true,
      permissions
    });
    
    // Third recruiter is not in round's interviewers list, is not owner, is not hiring manager
    await api('get', `/api/v1/interviews/feedback/${r}`, thirdRecruiter.token).expect(403);

    // Hiring manager (secondInterviewer) can fetch round feedback (which returns all feedback!)
    const rFeed = await api('get', `/api/v1/interviews/feedback/${r}`, secondInterviewer.token).expect(200);
    expect(rFeed.body.data.feedback).toHaveLength(2); // sees both
    expect(rFeed.body.data.aggregation.averageScore).toBe(78); // average of 68% and 88% is 78%
  });

  it('should support candidate self-service responses and pipeline transitions', async () => {
    const owner = await recruiter();
    const cand = await user('candidate');
    const app = await application(owner, cand);

    const t = await api('post', '/api/v1/interviews/templates', owner.token)
      .send(templateBody)
      .expect(201);
    
    const p = await api('post', '/api/v1/interviews/processes', owner.token)
      .send({ applicationId: app.id, templateId: t.body.data.template._id })
      .expect(201);
    
    const r = p.body.data.process.rounds[0];

    const start = new Date(Date.now() + 3600000);
    const end = new Date(start.getTime() + 3600000);

    // Recruiter schedules
    const sRes = await api('post', `/api/v1/interviews/processes/manage/${p.body.data.process._id}/rounds/${r}/schedule`, owner.token)
      .send({
        interviewerIds: [owner.user.id],
        timezone: 'UTC',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        mode: 'video',
        meetingProvider: 'google-meet'
      })
      .expect(201);

    const scheduleId = sRes.body.data.schedule._id;

    // Candidate declines
    await api('patch', `/api/v1/interviews/me/schedules/${scheduleId}/respond`, cand.token)
      .send({ response: 'declined', reason: 'Unavailable' })
      .expect(200);

    // Verify candidate response cancels the schedule and sets app back to shortlisted
    const schedule = await InterviewSchedule.findById(scheduleId);
    expect(schedule.status).toBe('cancelled');
    expect(schedule.candidateResponse).toBe('declined');

    const updatedApp = await Application.findById(app.id);
    expect(updatedApp.status).toBe('shortlisted');
  });

  it('should handle calendar OAuth mock connect flow and track meeting join/leave events', async () => {
    const owner = await recruiter();
    
    const cand = await user('candidate');
    const app = await application(owner, cand);

    const t = await api('post', '/api/v1/interviews/templates', owner.token)
      .send(templateBody)
      .expect(201);
    
    const p = await api('post', '/api/v1/interviews/processes', owner.token)
      .send({ applicationId: app.id, templateId: t.body.data.template._id })
      .expect(201);
    
    const r = p.body.data.process.rounds[0];

    const start = new Date(Date.now() + 3600000);
    const end = new Date(start.getTime() + 3600000);

    const sRes = await api('post', `/api/v1/interviews/processes/manage/${p.body.data.process._id}/rounds/${r}/schedule`, owner.token)
      .send({
        interviewerIds: [owner.user.id],
        timezone: 'UTC',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        mode: 'video',
        meetingProvider: 'google-meet'
      })
      .expect(201);

    const scheduleId = sRes.body.data.schedule._id;

    // Connect calendar redirect
    await api('get', `/api/v1/interviews/calendar/oauth/connect/google`, owner.token)
      .expect(302); // Redirects!

    // Track join/leave meeting
    await api('post', `/api/v1/interviews/schedules/${scheduleId}/join`, owner.token).expect(200);
    await api('post', `/api/v1/interviews/schedules/${scheduleId}/leave`, owner.token).expect(200);

    // Verify audit logs exist
    const joinLogs = await AuditLog.find({ action: 'interview.meeting_joined' });
    expect(joinLogs).toHaveLength(1);
    expect(joinLogs[0].newValue.scheduleId.toString()).toBe(scheduleId.toString());

    const leaveLogs = await AuditLog.find({ action: 'interview.meeting_left' });
    expect(leaveLogs).toHaveLength(1);
  });
});
