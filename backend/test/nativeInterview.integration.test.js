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
import { User } from '../src/models/User.js';
import { generateAccessToken } from '../src/utils/jwt.js';

let db;
let seq = 0;
const permissions = [
  'interviews.view',
  'interviews.manage',
  'interviews.schedule',
  'interviews.evaluate',
];

const api = (m, p, t) => request(app)[m](p).set('Authorization', `Bearer ${t}`);

const createUser = async (role) => {
  seq++;
  const u = await User.create({
    fullName: `${role} User ${seq}`,
    email: `${role}${seq}@native.test`,
    password: 'Strong!Pass123',
    role,
    isActive: true,
    blocked: false,
  });
  return { user: u, token: generateAccessToken(u.id) };
};

const createRecruiter = async () => {
  const a = await createUser('recruiter');
  const company = await Company.create({
    name: `Company Native ${seq}`,
    slug: `company-native-${seq}`,
    owner: a.user.id,
    verificationStatus: 'verified',
    isActive: true,
    teamMembers: [
      { recruiter: a.user.id, role: 'owner', permissions, status: 'active' },
    ],
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

const createApplication = async (o, c) =>
  Application.create({
    candidate: c.user.id,
    candidateProfile: new mongoose.Types.ObjectId(),
    job: new mongoose.Types.ObjectId(),
    company: o.company.id,
    applicationNumber: `TVX-NATIVE-${seq}-${Date.now()}`,
    status: 'shortlisted',
    candidateSnapshot: { fullName: c.user.fullName },
    jobSnapshot: { title: 'Senior Software Engineer' },
    skillMatch: { score: 95, matchedSkills: ['Node.js', 'React'], missingRequiredSkills: [], breakdown: [] },
  });

beforeAll(async () => {
  db = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(db.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await db.stop();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Company.deleteMany({}),
    InterviewFeedback.deleteMany({}),
    InterviewProcess.deleteMany({}),
    InterviewRound.deleteMany({}),
    InterviewSchedule.deleteMany({}),
    InterviewTemplate.deleteMany({}),
    RecruiterProfile.deleteMany({}),
  ]);
});

describe('Native Talvix Interview Platform Integration Tests', () => {
  it('schedules native interview with joinAvailableAt (-5m) and endsAt (+duration) calculated', async () => {
    const rec = await createRecruiter();
    const cand = await createUser('candidate');
    const appDoc = await createApplication(rec, cand);

    const template = await InterviewTemplate.create({
      name: 'Engineering Interview',
      company: rec.company.id,
      createdBy: rec.user.id,
      rounds: [
        {
          name: 'Technical Round',
          type: 'technical',
          durationMinutes: 45,
          order: 0,
          required: true,
          minimumInterviewers: 1,
          maximumInterviewers: 1,
          scorecardTemplate: {
            criteria: [{ id: 'arch', name: 'Architecture', category: 'technical', weight: 1, maximumScore: 5, required: true }],
          },
        },
      ],
    });

    const processRes = await api('post', '/api/v1/interviews/processes', rec.token)
      .send({ applicationId: appDoc.id, templateId: template.id })
      .expect(201);

    const proc = processRes.body.data.process;
    const roundId = proc.rounds[0]._id || proc.rounds[0];

    const startTime = new Date(Date.now() + 3600000); // 1 hour from now
    const endTime = new Date(startTime.getTime() + 45 * 60000);

    const schedRes = await api('post', `/api/v1/interviews/processes/manage/${proc._id}/rounds/${roundId}/schedule`, rec.token)
      .send({
        interviewerIds: [rec.user.id],
        timezone: 'UTC',
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        mode: 'video',
        meetingProvider: 'native',
      })
      .expect(201);

    const sched = schedRes.body.data.schedule;
    expect(sched.status).toBe('scheduled');
    expect(sched.joinWindowMinutes).toBe(5);
    expect(new Date(sched.joinAvailableAt).getTime()).toBe(startTime.getTime() - 5 * 60000);
    expect(new Date(sched.endsAt).getTime()).toBe(endTime.getTime());
  });

  it('enforces server-side time gating on interview start endpoint', async () => {
    const rec = await createRecruiter();
    const cand = await createUser('candidate');
    const appDoc = await createApplication(rec, cand);

    const template = await InterviewTemplate.create({
      name: 'Tech Interview',
      company: rec.company.id,
      createdBy: rec.user.id,
      rounds: [
        {
          name: 'Tech Round',
          type: 'technical',
          durationMinutes: 30,
          order: 0,
          required: true,
          scorecardTemplate: { criteria: [] },
        },
      ],
    });

    const procRes = await api('post', '/api/v1/interviews/processes', rec.token)
      .send({ applicationId: appDoc.id, templateId: template.id })
      .expect(201);
    const roundId = procRes.body.data.process.rounds[0]._id || procRes.body.data.process.rounds[0];

    // Case 1: Future schedule (> 10 mins away) -> Start fails with 403 INTERVIEW_NOT_OPEN
    const futureStart = new Date(Date.now() + 3600000);
    const futureEnd = new Date(futureStart.getTime() + 1800000);

    const schedRes = await api('post', `/api/v1/interviews/processes/manage/${procRes.body.data.process._id}/rounds/${roundId}/schedule`, rec.token)
      .send({
        interviewerIds: [rec.user.id],
        timezone: 'Asia/Kolkata',
        startTime: futureStart.toISOString(),
        endTime: futureEnd.toISOString(),
        mode: 'video',
        meetingProvider: 'native',
      })
      .expect(201);

    const schedId = schedRes.body.data.schedule._id;

    const earlyStart = await api('post', `/api/v1/interviews/schedules/${schedId}/start`, cand.token);
    expect(earlyStart.status).toBe(403);
    expect(earlyStart.body.message).toContain('Interview window is not open yet');

    // Case 2: Update schedule to current time window (started 1 min ago) -> Start succeeds & transitions to in_progress
    const currentStart = new Date(Date.now() - 60000);
    const currentEnd = new Date(Date.now() + 1800000);

    await InterviewSchedule.updateOne(
      { _id: schedId },
      {
        $set: {
          startTime: currentStart,
          endTime: currentEnd,
          scheduledAt: currentStart,
          endsAt: currentEnd,
          joinAvailableAt: new Date(currentStart.getTime() - 300000),
        },
      }
    );

    const validStart = await api('post', `/api/v1/interviews/schedules/${schedId}/start`, cand.token);
    expect(validStart.status).toBe(200);
    expect(validStart.body.data.status).toBe('in_progress');
    expect(validStart.body.data.canStart).toBe(true);

    // Case 3: Expired schedule -> Start fails with 403 INTERVIEW_EXPIRED
    const expiredStart = new Date(Date.now() - 7200000);
    const expiredEnd = new Date(Date.now() - 3600000);

    await InterviewSchedule.updateOne(
      { _id: schedId },
      {
        $set: {
          startTime: expiredStart,
          endTime: expiredEnd,
          scheduledAt: expiredStart,
          endsAt: expiredEnd,
          joinAvailableAt: new Date(expiredStart.getTime() - 300000),
          status: 'expired',
        },
      }
    );

    const expiredRes = await api('post', `/api/v1/interviews/schedules/${schedId}/start`, cand.token);
    expect(expiredRes.status).toBe(403);
  });

  it('enforces RBAC and IDOR security protection on interview schedules', async () => {
    const rec1 = await createRecruiter();
    const rec2 = await createRecruiter();
    const cand1 = await createUser('candidate');
    const cand2 = await createUser('candidate');

    const appDoc = await createApplication(rec1, cand1);
    const template = await InterviewTemplate.create({
      name: 'Security Test',
      company: rec1.company.id,
      createdBy: rec1.user.id,
      rounds: [{ name: 'Round 1', type: 'screening', durationMinutes: 30, order: 0, scorecardTemplate: { criteria: [] } }],
    });

    const proc = await api('post', '/api/v1/interviews/processes', rec1.token)
      .send({ applicationId: appDoc.id, templateId: template.id })
      .expect(201);
    const roundId = proc.body.data.process.rounds[0]._id || proc.body.data.process.rounds[0];

    const start = new Date(Date.now() + 3600000);
    const end = new Date(start.getTime() + 30 * 60000);
    const sched = await api('post', `/api/v1/interviews/processes/manage/${proc.body.data.process._id}/rounds/${roundId}/schedule`, rec1.token)
      .send({
        interviewerIds: [rec1.user.id],
        timezone: 'UTC',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        mode: 'video',
        meetingProvider: 'native',
      })
      .expect(201);

    const schedId = sched.body.data.schedule._id;

    // Candidate 1 (owner) can view details
    await api('get', `/api/v1/interviews/schedules/${schedId}`, cand1.token).expect(200);

    // Candidate 2 (unauthorized) gets 403 Forbidden
    await api('get', `/api/v1/interviews/schedules/${schedId}`, cand2.token).expect(403);

    // Recruiter 2 (outsider company) gets 403 Forbidden
    await api('get', `/api/v1/interviews/schedules/${schedId}`, rec2.token).expect(403);
  });

  it('handles rescheduling, updates time boundaries, and appends to rescheduleHistory', async () => {
    const rec = await createRecruiter();
    const cand = await createUser('candidate');
    const appDoc = await createApplication(rec, cand);

    const template = await InterviewTemplate.create({
      name: 'Reschedule Test',
      company: rec.company.id,
      createdBy: rec.user.id,
      rounds: [{ name: 'Round 1', type: 'screening', durationMinutes: 30, order: 0, scorecardTemplate: { criteria: [] } }],
    });

    const proc = await api('post', '/api/v1/interviews/processes', rec.token)
      .send({ applicationId: appDoc.id, templateId: template.id })
      .expect(201);
    const roundId = proc.body.data.process.rounds[0]._id || proc.body.data.process.rounds[0];

    const start1 = new Date(Date.now() + 3600000);
    const end1 = new Date(start1.getTime() + 30 * 60000);

    const schedRes = await api('post', `/api/v1/interviews/processes/manage/${proc.body.data.process._id}/rounds/${roundId}/schedule`, rec.token)
      .send({
        interviewerIds: [rec.user.id],
        timezone: 'UTC',
        startTime: start1.toISOString(),
        endTime: end1.toISOString(),
        mode: 'video',
        meetingProvider: 'native',
      })
      .expect(201);

    const schedId = schedRes.body.data.schedule._id;

    // Reschedule to 5 hours later
    const start2 = new Date(Date.now() + 18000000);
    const end2 = new Date(start2.getTime() + 30 * 60000);

    await api('patch', `/api/v1/interviews/processes/manage/${proc.body.data.process._id}/rounds/${roundId}/reschedule`, rec.token)
      .send({
        interviewerIds: [rec.user.id],
        timezone: 'UTC',
        startTime: start2.toISOString(),
        endTime: end2.toISOString(),
        mode: 'video',
        meetingProvider: 'native',
        reason: 'Recruiter schedule conflict',
      })
      .expect(200);

    const updatedDoc = await InterviewSchedule.findById(schedId);
    expect(updatedDoc.version).toBe(2);
    expect(new Date(updatedDoc.startTime).getTime()).toBe(start2.getTime());
    expect(updatedDoc.rescheduleHistory).toHaveLength(1);
    expect(new Date(updatedDoc.rescheduleHistory[0].previousScheduledAt).getTime()).toBe(start1.getTime());
    expect(updatedDoc.rescheduleHistory[0].reason).toBe('Recruiter schedule conflict');
  });

  it('allows end interview action and transitions state to completed', async () => {
    const rec = await createRecruiter();
    const cand = await createUser('candidate');
    const appDoc = await createApplication(rec, cand);

    const template = await InterviewTemplate.create({
      name: 'End Test',
      company: rec.company.id,
      createdBy: rec.user.id,
      rounds: [{ name: 'Round 1', type: 'screening', durationMinutes: 30, order: 0, scorecardTemplate: { criteria: [] } }],
    });

    const proc = await api('post', '/api/v1/interviews/processes', rec.token)
      .send({ applicationId: appDoc.id, templateId: template.id })
      .expect(201);
    const roundId = proc.body.data.process.rounds[0]._id || proc.body.data.process.rounds[0];

    const start = new Date(Date.now() + 3600000);
    const end = new Date(start.getTime() + 30 * 60000);
    const schedRes = await api('post', `/api/v1/interviews/processes/manage/${proc.body.data.process._id}/rounds/${roundId}/schedule`, rec.token)
      .send({
        interviewerIds: [rec.user.id],
        timezone: 'UTC',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        mode: 'video',
        meetingProvider: 'native',
      })
      .expect(201);

    const schedId = schedRes.body.data.schedule._id;

    const activeStart = new Date(Date.now() - 60000);
    const activeEnd = new Date(activeStart.getTime() + 30 * 60000);
    await InterviewSchedule.updateOne(
      { _id: schedId },
      {
        $set: {
          startTime: activeStart,
          endTime: activeEnd,
          scheduledAt: activeStart,
          endsAt: activeEnd,
          joinAvailableAt: new Date(activeStart.getTime() - 300000),
        },
      }
    );

    // Start session
    await api('post', `/api/v1/interviews/schedules/${schedId}/start`, rec.token).expect(200);

    // End session
    const endRes = await api('post', `/api/v1/interviews/schedules/${schedId}/end`, rec.token).expect(200);
    expect(endRes.body.data.status).toBe('completed');
    expect(endRes.body.data.completedAt).toBeDefined();

    const doc = await InterviewSchedule.findById(schedId);
    expect(doc.status).toBe('completed');
  });

});
