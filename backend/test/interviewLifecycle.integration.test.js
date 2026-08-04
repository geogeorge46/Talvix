import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { Application } from "../src/models/Application.js";
import { Company } from "../src/models/Company.js";
import { InterviewFeedback } from "../src/models/InterviewFeedback.js";
import { InterviewProcess } from "../src/models/InterviewProcess.js";
import { InterviewRound } from "../src/models/InterviewRound.js";
import { InterviewSchedule } from "../src/models/InterviewSchedule.js";
import { InterviewTemplate } from "../src/models/InterviewTemplate.js";
import { NotificationOutbox } from "../src/models/NotificationOutbox.js";
import { RecruiterProfile } from "../src/models/RecruiterProfile.js";
import { User } from "../src/models/User.js";
import { BackgroundJob } from "../src/models/BackgroundJob.js";
import { generateAccessToken } from "../src/utils/jwt.js";
import { executeJob } from "../src/services/backgroundJobs.service.js";

let db;
let seq = 0;
const permissions = [
  "interviews.view",
  "interviews.manage",
  "interviews.schedule",
  "interviews.evaluate",
];

const api = (m, p, t) => request(app)[m](p).set("Authorization", `Bearer ${t}`);

const user = async (role) => {
  seq++;
  const u = await User.create({
    fullName: `${role} ${seq}`,
    email: `${role}${seq}@lifecycle.test`,
    password: "Strong!Pass123",
    role,
    isActive: true,
    blocked: false,
  });
  return { user: u, token: generateAccessToken(u.id) };
};

const recruiter = async () => {
  const a = await user("recruiter");
  const company = await Company.create({
    name: `Company ${seq}`,
    slug: `company-${seq}`,
    owner: a.user.id,
    verificationStatus: "verified",
    isActive: true,
    teamMembers: [
      { recruiter: a.user.id, role: "owner", permissions, status: "active" },
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

const templateBody = {
  name: "Eng Interview",
  rounds: [
    {
      name: "Technical",
      type: "technical",
      durationMinutes: 60,
      order: 0,
      required: true,
      minimumInterviewers: 1,
      maximumInterviewers: 1,
      scorecardTemplate: {
        criteria: [
          {
            id: "node",
            name: "Node.js",
            category: "technical",
            weight: 2,
            maximumScore: 5,
            required: true,
          },
        ],
      },
    },
  ],
};

const application = async (o, c) =>
  Application.create({
    candidate: c.user.id,
    candidateProfile: new mongoose.Types.ObjectId(),
    job: new mongoose.Types.ObjectId(),
    company: o.company.id,
    applicationNumber: `TVX-LIFECYCLE-${seq}-${Date.now()}`,
    status: "shortlisted",
    candidateSnapshot: { fullName: c.user.fullName },
    jobSnapshot: { title: "Engineer" },
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
    NotificationOutbox.deleteMany({}),
    RecruiterProfile.deleteMany({}),
    BackgroundJob.deleteMany({}),
  ]);
});

describe("Interview Lifecycle & Integration Features", () => {
  it("automatically generates meeting link for google-meet and syncs calendar", async () => {
    const rec = await recruiter();
    const cand = await user("candidate");
    const appDoc = await application(rec, cand);

    // Create process
    const resTemplate = await api("post", "/api/v1/interviews/templates", rec.token).send(templateBody);
    const processRes = await api("post", "/api/v1/interviews/processes", rec.token).send({
      applicationId: appDoc.id,
      templateId: resTemplate.body.data.template._id,
    });
    const proc = processRes.body.data.process;
    const round = proc.rounds[0];

    // Schedule round with google-meet (leaving meetingUrl blank)
    const schedulePayload = {
      interviewerIds: [rec.user.id],
      timezone: "America/New_York",
      startTime: new Date(Date.now() + 86400000).toISOString(),
      endTime: new Date(Date.now() + 86400000 + 3600000).toISOString(),
      mode: "video",
      meetingProvider: "google-meet",
    };

    const schedRes = await api("post", `/api/v1/interviews/processes/manage/${proc._id}/rounds/${round}/schedule`, rec.token).send(schedulePayload);
    expect(schedRes.status).toBe(201);
    expect(schedRes.body.data.schedule.meetingUrl).toMatch(/^https:\/\/meet\.google\.com\/[a-z0-9]{3}-[a-z0-9]{3}-[a-z0-9]{3}$/);
    expect(schedRes.body.data.schedule.meetingProvider).toBe("google-meet");

    // Retrieve schedule and verify
    const scheduleId = schedRes.body.data.schedule._id;
    const retrieveRes = await api("get", `/api/v1/interviews/me/schedules/${scheduleId}`, cand.token);
    expect(retrieveRes.status).toBe(200);
    expect(retrieveRes.body.data.schedule.meetingUrl).toBe(schedRes.body.data.schedule.meetingUrl);
  });

  it("serves the standard ICS calendar invite download endpoint with secure tenant checks", async () => {
    const rec = await recruiter();
    const otherRec = await recruiter();
    const cand = await user("candidate");
    const appDoc = await application(rec, cand);

    const resTemplate = await api("post", "/api/v1/interviews/templates", rec.token).send(templateBody);
    const processRes = await api("post", "/api/v1/interviews/processes", rec.token).send({
      applicationId: appDoc.id,
      templateId: resTemplate.body.data.template._id,
    });
    const proc = processRes.body.data.process;
    const round = proc.rounds[0];

    const startTime = new Date(Date.now() + 86400000).toISOString();
    const endTime = new Date(Date.now() + 86400000 + 3600000).toISOString();

    const schedRes = await api("post", `/api/v1/interviews/processes/manage/${proc._id}/rounds/${round}/schedule`, rec.token).send({
      interviewerIds: [rec.user.id],
      timezone: "America/New_York",
      startTime,
      endTime,
      mode: "video",
      meetingProvider: "google-meet",
    });

    const scheduleId = schedRes.body.data.schedule._id;

    // Recruiter who owns the process should download successfully
    const downloadRes = await api("get", `/api/v1/interviews/schedules/${scheduleId}/ics`, rec.token);
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers["content-type"]).toBe("text/calendar; charset=utf-8");
    expect(downloadRes.text).toContain("BEGIN:VCALENDAR");
    expect(downloadRes.text).toContain("SUMMARY:Interview:");

    // Candidate should also download successfully
    const downloadCandRes = await api("get", `/api/v1/interviews/schedules/${scheduleId}/ics`, cand.token);
    expect(downloadCandRes.status).toBe(200);

    // Recruiter of another company should get 403 Forbidden
    const downloadFailRes = await api("get", `/api/v1/interviews/schedules/${scheduleId}/ics`, otherRec.token);
    expect(downloadFailRes.status).toBe(403);
  });

  it("stores optional document attachments on scorecard feedback submissions", async () => {
    const rec = await recruiter();
    const cand = await user("candidate");
    const appDoc = await application(rec, cand);

    const resTemplate = await api("post", "/api/v1/interviews/templates", rec.token).send(templateBody);
    const processRes = await api("post", "/api/v1/interviews/processes", rec.token).send({
      applicationId: appDoc.id,
      templateId: resTemplate.body.data.template._id,
    });
    const proc = processRes.body.data.process;
    const round = proc.rounds[0];

    const startTime = new Date(Date.now() + 86400000).toISOString();
    const endTime = new Date(Date.now() + 86400000 + 3600000).toISOString();

    await api("post", `/api/v1/interviews/processes/manage/${proc._id}/rounds/${round}/schedule`, rec.token).send({
      interviewerIds: [rec.user.id],
      timezone: "America/New_York",
      startTime,
      endTime,
      mode: "video",
      meetingProvider: "google-meet",
    });

    // Start round
    await api("patch", `/api/v1/interviews/processes/manage/${proc._id}/rounds/${round}/start`, rec.token);

    // Save feedback draft with mock file attachments
    const docId1 = new mongoose.Types.ObjectId();
    const docId2 = new mongoose.Types.ObjectId();
    const feedbackPayload = {
      scores: [{ criterionId: "node", score: 4, comment: "Decent Node skills" }],
      recommendation: "hire",
      strengths: ["Clean coding style"],
      concerns: ["Takes time to design solution"],
      attachments: [docId1.toString(), docId2.toString()],
    };

    const feedbackRes = await api("put", `/api/v1/interviews/feedback/${round}/me`, rec.token).send(feedbackPayload);
    expect(feedbackRes.status).toBe(200);

    const scoreDoc = await InterviewFeedback.findOne({ round, interviewer: rec.user.id });
    expect(scoreDoc.attachments.map(String)).toContain(docId1.toString());
    expect(scoreDoc.attachments.map(String)).toContain(docId2.toString());
  });

  it("handles background jobs including REMIND_FEEDBACK_PENDING, SYNC_CALENDAR, and CLEANUP_EXPIRED_MEETINGS", async () => {
    const rec = await recruiter();
    const cand = await user("candidate");
    const appDoc = await application(rec, cand);

    const resTemplate = await api("post", "/api/v1/interviews/templates", rec.token).send(templateBody);
    const processRes = await api("post", "/api/v1/interviews/processes", rec.token).send({
      applicationId: appDoc.id,
      templateId: resTemplate.body.data.template._id,
    });
    const proc = processRes.body.data.process;
    const round = proc.rounds[0];

    const startTime = new Date(Date.now() + 86400000).toISOString();
    const endTime = new Date(Date.now() + 86400000 + 3600000).toISOString();

    await api("post", `/api/v1/interviews/processes/manage/${proc._id}/rounds/${round}/schedule`, rec.token).send({
      interviewerIds: [rec.user.id],
      timezone: "America/New_York",
      startTime,
      endTime,
      mode: "video",
      meetingProvider: "google-meet",
    });

    // Move round to awaiting-feedback
    await api("patch", `/api/v1/interviews/processes/manage/${proc._id}/rounds/${round}/start`, rec.token);
    // Explicitly transition round status to awaiting-feedback
    await InterviewRound.updateOne({ _id: round }, { status: "awaiting-feedback" });

    // Create and execute REMIND_FEEDBACK_PENDING job
    const jobRemind = await BackgroundJob.create({
      type: "REMIND_FEEDBACK_PENDING",
      payload: {},
      status: "pending",
    });

    await executeJob(jobRemind);
    expect(jobRemind.status).toBe("completed");

    // Verify reminder event is pushed to NotificationOutbox
    const reminderLog = await NotificationOutbox.findOne({
      deduplicationKey: `feedback-pending:${round}:${rec.user.id}`,
    });
    expect(reminderLog).toBeDefined();
    expect(reminderLog.payload.roundId).toBe(round.toString());
    expect(reminderLog.payload.reminderOffset).toBe("feedback-pending");

    // Create and execute SYNC_CALENDAR job
    const jobSync = await BackgroundJob.create({
      type: "SYNC_CALENDAR",
      payload: {},
      status: "pending",
    });
    await executeJob(jobSync);
    expect(jobSync.status).toBe("completed");

    // Create and execute CLEANUP_EXPIRED_MEETINGS job
    const jobCleanup = await BackgroundJob.create({
      type: "CLEANUP_EXPIRED_MEETINGS",
      payload: {},
      status: "pending",
    });
    await executeJob(jobCleanup);
    expect(jobCleanup.status).toBe("completed");
  });
});
