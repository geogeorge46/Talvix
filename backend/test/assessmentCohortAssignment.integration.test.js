import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { Application } from '../src/models/Application.js';
import { Assessment } from '../src/models/Assessment.js';
import { AssessmentAssignment } from '../src/models/AssessmentAssignment.js';
import { AssessmentAttempt } from '../src/models/AssessmentAttempt.js';
import { Company } from '../src/models/Company.js';
import { Question } from '../src/models/Question.js';
import { RecruiterProfile } from '../src/models/RecruiterProfile.js';
import { User } from '../src/models/User.js';
import { generateAccessToken } from '../src/utils/jwt.js';

let replicaSet;
let sequence = 0;
const permissions = ['assessments.view', 'assessments.manage', 'assessments.assign', 'assessments.review', 'applications.manage'];
const api = (method, path, token) => request(app)[method](path).set('Authorization', `Bearer ${token}`);
const account = async (role) => {
  sequence += 1;
  const user = await User.create({ fullName: `${role} ${sequence}`, email: `${role}.${sequence}@bulk.test`, password: 'Strong!Pass123', role });
  return { user, token: generateAccessToken(user.id) };
};
const recruiter = async () => {
  const owner = await account('recruiter');
  const company = await Company.create({
    name: `Bulk Co ${sequence}`,
    slug: `bulk-co-${sequence}`,
    owner: owner.user.id,
    verificationStatus: 'verified',
    isActive: true,
    teamMembers: [{ recruiter: owner.user.id, role: 'owner', permissions, status: 'active' }],
  });
  await RecruiterProfile.create({ user: owner.user.id, company: company.id, isApproved: true, isCompanyOwner: true, permissions });
  return { ...owner, company };
};
const candidate = async () => account('candidate');
const applicationFor = async (owner, cand, status = 'shortlisted') =>
  Application.create({
    candidate: cand.user.id,
    candidateProfile: new mongoose.Types.ObjectId(),
    job: new mongoose.Types.ObjectId(),
    company: owner.company.id,
    applicationNumber: `TVX-BLK-${sequence}-${Date.now()}`,
    status,
    candidateSnapshot: { fullName: cand.user.fullName },
    jobSnapshot: { title: 'Software Engineer' },
    skillMatch: { score: 0, matchedSkills: [], missingRequiredSkills: [], breakdown: [] },
  });

const choiceBody = (title = 'Sample Q') => ({
  type: 'single-choice',
  title,
  prompt: 'Which runtime?',
  difficulty: 'easy',
  defaultMarks: 10,
  options: [{ id: 'opt1', text: 'Opt 1' }, { id: 'opt2', text: 'Opt 2' }],
  correctAnswer: { optionId: 'opt1' },
  explanation: 'Opt 1 is correct.',
});

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replicaSet.getUri());
  await Promise.all([User.init(), RecruiterProfile.init(), Company.init(), Application.init(), Question.init(), Assessment.init(), AssessmentAssignment.init(), AssessmentAttempt.init()]);
});

beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

describe('Assessment Cohort Assignment & Eligibility (Phase 1)', () => {
  it('preserves question category in assessment snapshot', async () => {
    const rec = await recruiter();
    const createdQ = await api('post', '/api/v1/assessments/questions', rec.token).send(choiceBody('Math Q')).expect(201);
    const qId = createdQ.body.data.question._id;
    await Question.findByIdAndUpdate(qId, { category: 'Aptitude & Logic' });

    const aRes = await api('post', '/api/v1/assessments', rec.token).send({
      title: 'Math Assessment',
      type: 'general',
      durationMinutes: 30,
      passingPercentage: 70,
    }).expect(201);
    const assessmentId = aRes.body.data.assessment._id;

    await api('post', `/api/v1/assessments/manage/${assessmentId}/questions`, rec.token).send({
      questionId: qId,
      marks: 10,
    }).expect(200);
    await api('patch', `/api/v1/assessments/manage/${assessmentId}/publish`, rec.token).expect(200);

    const cand = await candidate();
    const appDoc = await applicationFor(rec, cand);

    const assignRes = await api('post', '/api/v1/assessments/assignments', rec.token).send({
      assessmentId,
      applicationId: appDoc.id,
      availableFrom: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    }).expect(201);

    const fetched = await AssessmentAssignment.findById(assignRes.body.data.assignment._id);
    expect(fetched.assessmentSnapshot.questions[0].category).toBe('Aptitude & Logic');
  });

  it('evaluates candidate eligibility with breakdown: eligible, already-assigned, and ineligible', async () => {
    const rec = await recruiter();
    const createdQ = await api('post', '/api/v1/assessments/questions', rec.token).send(choiceBody('Testing Q')).expect(201);
    const qId = createdQ.body.data.question._id;

    const aRes = await api('post', '/api/v1/assessments', rec.token).send({
      title: 'Dev Screen',
      type: 'technical',
      durationMinutes: 45,
      passingPercentage: 60,
    }).expect(201);
    const assessmentId = aRes.body.data.assessment._id;

    await api('post', `/api/v1/assessments/manage/${assessmentId}/questions`, rec.token).send({
      questionId: qId,
      marks: 10,
    }).expect(200);
    await api('patch', `/api/v1/assessments/manage/${assessmentId}/publish`, rec.token).expect(200);

    const cand1 = await candidate();
    const cand2 = await candidate();
    const cand3 = await candidate();
    const cand4 = await candidate();

    const appEligible = await applicationFor(rec, cand1, 'shortlisted');
    const appAlreadyAssigned = await applicationFor(rec, cand2, 'shortlisted');
    const appWithdrawn = await applicationFor(rec, cand3, 'withdrawn');
    const appWrongStage = await applicationFor(rec, cand4, 'submitted');

    await api('post', '/api/v1/assessments/assignments', rec.token).send({
      assessmentId,
      applicationId: appAlreadyAssigned.id,
      availableFrom: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    }).expect(201);

    const eligRes = await api('post', '/api/v1/assessments/assignments/check-eligibility', rec.token).send({
      assessmentId,
      applicationIds: [appEligible.id, appAlreadyAssigned.id, appWithdrawn.id, appWrongStage.id],
    }).expect(200);

    const { summary, candidates: results } = eligRes.body.data;
    expect(summary.total).toBe(4);
    expect(summary.eligible).toBe(1);
    expect(summary.alreadyAssigned).toBe(1);
    expect(summary.ineligible).toBe(2);

    const rEligible = results.find((r) => r.applicationId === appEligible.id);
    expect(rEligible.status).toBe('eligible');

    const rAssigned = results.find((r) => r.applicationId === appAlreadyAssigned.id);
    expect(rAssigned.status).toBe('already-assigned');
    expect(rAssigned.reason).toContain('Active assignment already exists');

    const rWithdrawn = results.find((r) => r.applicationId === appWithdrawn.id);
    expect(rWithdrawn.status).toBe('ineligible');
    expect(rWithdrawn.reason).toContain('withdrawn');

    const rWrongStage = results.find((r) => r.applicationId === appWrongStage.id);
    expect(rWrongStage.status).toBe('ineligible');
    expect(rWrongStage.reason).toContain('stage "submitted" is not eligible');
  });

  it('safely performs bulk assignment for eligible cohort candidates', async () => {
    const rec = await recruiter();
    const createdQ = await api('post', '/api/v1/assessments/questions', rec.token).send(choiceBody('Color Q')).expect(201);
    const qId = createdQ.body.data.question._id;

    const aRes = await api('post', '/api/v1/assessments', rec.token).send({
      title: 'Cohort Test',
      type: 'general',
      durationMinutes: 60,
      passingPercentage: 50,
    }).expect(201);
    const assessmentId = aRes.body.data.assessment._id;

    await api('post', `/api/v1/assessments/manage/${assessmentId}/questions`, rec.token).send({
      questionId: qId,
      marks: 10,
    }).expect(200);
    await api('patch', `/api/v1/assessments/manage/${assessmentId}/publish`, rec.token).expect(200);

    const cand1 = await candidate();
    const cand2 = await candidate();
    const cand3 = await candidate();

    const app1 = await applicationFor(rec, cand1, 'shortlisted');
    const app2 = await applicationFor(rec, cand2, 'shortlisted');
    const app3 = await applicationFor(rec, cand3, 'withdrawn');

    await api('post', '/api/v1/assessments/assignments', rec.token).send({
      assessmentId,
      applicationId: app1.id,
      availableFrom: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    }).expect(201);

    const bulkRes = await api('post', '/api/v1/assessments/assignments/bulk', rec.token).send({
      assessmentId,
      applicationIds: [app1.id, app2.id, app3.id],
      availableFrom: new Date(),
      expiresAt: new Date(Date.now() + 172800000),
    }).expect(201);

    const { summary } = bulkRes.body.data;
    expect(summary.requested).toBe(3);
    expect(summary.assigned).toBe(1);
    expect(summary.alreadyAssigned).toBe(1);
    expect(summary.ineligible).toBe(1);

    const updatedApp2 = await Application.findById(app2.id);
    expect(updatedApp2.status).toBe('assessment-pending');

    const assignment2 = await AssessmentAssignment.findOne({ application: app2.id, assessment: assessmentId });
    expect(assignment2).toBeTruthy();
    expect(assignment2.status).toBe('available');
  });

  it('enforces multi-tenant company authorization on bulk assignment', async () => {
    const rec1 = await recruiter();
    const rec2 = await recruiter();

    const createdQ = await api('post', '/api/v1/assessments/questions', rec1.token).send(choiceBody('Q1')).expect(201);
    const aRes = await api('post', '/api/v1/assessments', rec1.token).send({
      title: 'Company 1 Test',
      type: 'general',
      durationMinutes: 30,
      passingPercentage: 50,
    }).expect(201);
    const assessmentId = aRes.body.data.assessment._id;

    await api('post', `/api/v1/assessments/manage/${assessmentId}/questions`, rec1.token).send({
      questionId: createdQ.body.data.question._id,
      marks: 10,
    }).expect(200);
    await api('patch', `/api/v1/assessments/manage/${assessmentId}/publish`, rec1.token).expect(200);

    const cand = await candidate();
    const app2 = await applicationFor(rec2, cand, 'shortlisted');

    const eligRes = await api('post', '/api/v1/assessments/assignments/check-eligibility', rec1.token).send({
      assessmentId,
      applicationIds: [app2.id],
    }).expect(200);

    expect(eligRes.body.data.summary.ineligible).toBe(1);
    expect(eligRes.body.data.candidates[0].reason).toContain('Application not found for this company');
  });

  it('aggregates cohort leaderboard with category scores and provisional review flags', async () => {
    const rec = await recruiter();

    // Create 2 questions in distinct categories
    const q1 = await api('post', '/api/v1/assessments/questions', rec.token).send({
      type: 'single-choice',
      prompt: 'Algorithm question: time complexity?',
      difficulty: 'easy',
      defaultMarks: 20,
      skills: ['algorithms'],
      options: [{ id: 'o1', text: 'O(1)' }, { id: 'o2', text: 'O(n)' }],
      correctAnswer: { optionId: 'o1' },
    }).expect(201);
    await Question.findByIdAndUpdate(q1.body.data.question._id, { category: 'Domain Coding' });

    const q2 = await api('post', '/api/v1/assessments/questions', rec.token).send({
      type: 'single-choice',
      prompt: 'Aptitude question: Next in series?',
      difficulty: 'easy',
      defaultMarks: 30,
      skills: ['aptitude'],
      options: [{ id: 'a1', text: '42' }, { id: 'a2', text: '50' }],
      correctAnswer: { optionId: 'a1' },
    }).expect(201);
    await Question.findByIdAndUpdate(q2.body.data.question._id, { category: 'Aptitude & Logic' });

    const aRes = await api('post', '/api/v1/assessments', rec.token).send({
      title: 'Full Evaluation Assessment',
      type: 'general',
      durationMinutes: 60,
      passingPercentage: 50,
    }).expect(201);
    const assessmentId = aRes.body.data.assessment._id;

    await api('post', `/api/v1/assessments/manage/${assessmentId}/questions`, rec.token).send({
      questionId: q1.body.data.question._id,
      marks: 20,
    }).expect(200);
    await api('post', `/api/v1/assessments/manage/${assessmentId}/questions`, rec.token).send({
      questionId: q2.body.data.question._id,
      marks: 30,
    }).expect(200);
    await api('patch', `/api/v1/assessments/manage/${assessmentId}/publish`, rec.token).expect(200);

    // 4 Candidates in cohort
    const cand1 = await candidate(); // will score 100% (20/20 in Coding, 30/30 in Aptitude)
    const cand2 = await candidate(); // will score 40% (20/20 in Coding, 0/30 in Aptitude)
    const cand3 = await candidate(); // will be in-progress (unsubmitted)
    const cand4 = await candidate(); // will not start

    const app1 = await applicationFor(rec, cand1, 'shortlisted');
    const app2 = await applicationFor(rec, cand2, 'shortlisted');
    const app3 = await applicationFor(rec, cand3, 'shortlisted');
    const app4 = await applicationFor(rec, cand4, 'shortlisted');

    // Bulk assign all 4 candidates
    await api('post', '/api/v1/assessments/assignments/bulk', rec.token).send({
      assessmentId,
      applicationIds: [app1.id, app2.id, app3.id, app4.id],
      availableFrom: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    }).expect(201);

    const assign1 = await AssessmentAssignment.findOne({ application: app1.id, assessment: assessmentId });
    const assign2 = await AssessmentAssignment.findOne({ application: app2.id, assessment: assessmentId });
    const assign3 = await AssessmentAssignment.findOne({ application: app3.id, assessment: assessmentId });

    // Candidate 1 attempts and submits perfect score
    const start1 = await api('post', `/api/v1/assessments/assignments/me/${assign1._id}/start`, cand1.token).expect(201);
    await api('patch', `/api/v1/assessments/attempts/me/${start1.body.data.attempt.id}/answers`, cand1.token).send({
      questionId: q1.body.data.question._id,
      answer: 'o1',
    }).expect(200);
    await api('patch', `/api/v1/assessments/attempts/me/${start1.body.data.attempt.id}/answers`, cand1.token).send({
      questionId: q2.body.data.question._id,
      answer: 'a1',
    }).expect(200);
    await api('post', `/api/v1/assessments/attempts/me/${start1.body.data.attempt.id}/submit`, cand1.token).expect(200);

    // Candidate 2 attempts and answers only Q1 correctly
    const start2 = await api('post', `/api/v1/assessments/assignments/me/${assign2._id}/start`, cand2.token).expect(201);
    await api('patch', `/api/v1/assessments/attempts/me/${start2.body.data.attempt.id}/answers`, cand2.token).send({
      questionId: q1.body.data.question._id,
      answer: 'o1',
    }).expect(200);
    await api('patch', `/api/v1/assessments/attempts/me/${start2.body.data.attempt.id}/answers`, cand2.token).send({
      questionId: q2.body.data.question._id,
      answer: 'a2', // wrong
    }).expect(200);
    await api('post', `/api/v1/assessments/attempts/me/${start2.body.data.attempt.id}/submit`, cand2.token).expect(200);

    // Candidate 3 starts but does not submit (in-progress)
    await api('post', `/api/v1/assessments/assignments/me/${assign3._id}/start`, cand3.token).expect(201);

    // Query cohort leaderboard
    const lbRes = await api('get', `/api/v1/assessments/manage/${assessmentId}/cohort-leaderboard`, rec.token).expect(200);
    const { summary, candidates: rows } = lbRes.body.data;

    expect(summary.totalAssigned).toBe(4);
    expect(summary.completed).toBe(2);
    expect(summary.inProgress).toBe(1);
    expect(summary.notStarted).toBe(1);

    // Candidate 1 should be rank 1 with 100%
    const c1Row = rows.find((r) => r.candidateId === cand1.user.id);
    expect(c1Row.rank).toBe(1);
    expect(c1Row.percentage).toBe(100);
    expect(c1Row.passed).toBe(true);
    expect(c1Row.isProvisional).toBe(false);

    // Category breakdown checks for cand1
    const codingCat1 = c1Row.categoryScores.find((cs) => cs.category === 'Domain Coding');
    expect(codingCat1.totalMarks).toBe(20);
    expect(codingCat1.awardedMarks).toBe(20);
    expect(codingCat1.percentage).toBe(100);

    const aptCat1 = c1Row.categoryScores.find((cs) => cs.category === 'Aptitude & Logic');
    expect(aptCat1.totalMarks).toBe(30);
    expect(aptCat1.awardedMarks).toBe(30);
    expect(aptCat1.percentage).toBe(100);

    // Candidate 2 should be rank 2 with 40% (20/50 marks)
    const c2Row = rows.find((r) => r.candidateId === cand2.user.id);
    expect(c2Row.rank).toBe(2);
    expect(c2Row.percentage).toBe(40);
    expect(c2Row.passed).toBe(false);

    const codingCat2 = c2Row.categoryScores.find((cs) => cs.category === 'Domain Coding');
    expect(codingCat2.percentage).toBe(100);

    const aptCat2 = c2Row.categoryScores.find((cs) => cs.category === 'Aptitude & Logic');
    expect(aptCat2.percentage).toBe(0);

    // Candidate 3 and 4 should have rank null and no evaluated score
    const c3Row = rows.find((r) => r.candidateId === cand3.user.id);
    expect(c3Row.status).toBe('in-progress');
    expect(c3Row.rank).toBeNull();
    expect(c3Row.score).toBeNull();

    const c4Row = rows.find((r) => r.candidateId === cand4.user.id);
    expect(c4Row.status).toBe('not-started');
    expect(c4Row.rank).toBeNull();
  });

  it('promotes candidate to interview stage with transition validation and audit trail', async () => {
    const rec = await recruiter();
    const createdQ = await api('post', '/api/v1/assessments/questions', rec.token).send(choiceBody('Promotion Q')).expect(201);

    const aRes = await api('post', '/api/v1/assessments', rec.token).send({
      title: 'Promotion Test',
      type: 'general',
      durationMinutes: 30,
      passingPercentage: 50,
    }).expect(201);
    const assessmentId = aRes.body.data.assessment._id;

    await api('post', `/api/v1/assessments/manage/${assessmentId}/questions`, rec.token).send({
      questionId: createdQ.body.data.question._id,
      marks: 10,
    }).expect(200);
    await api('patch', `/api/v1/assessments/manage/${assessmentId}/publish`, rec.token).expect(200);

    const cand1 = await candidate();
    const cand2 = await candidate();
    const cand3 = await candidate();

    // cand1: completed assessment (eligible to transition to 'interview-scheduled')
    const app1 = await applicationFor(rec, cand1, 'assessment-completed');
    // cand2: shortlisted (eligible to transition to 'interview-scheduled')
    const app2 = await applicationFor(rec, cand2, 'shortlisted');
    // cand3: wrong stage e.g. 'submitted' (cannot directly transition to 'interview-scheduled')
    const app3 = await applicationFor(rec, cand3, 'submitted');

    // Create assignments for all 3
    await AssessmentAssignment.create([
      { assessment: assessmentId, assessmentVersion: 1, assessmentSnapshot: { title: 'Test', questions: [] }, application: app1.id, candidate: cand1.user.id, company: rec.company.id, assignedBy: rec.user.id, availableFrom: new Date(), expiresAt: new Date(Date.now() + 86400000), status: 'completed' },
      { assessment: assessmentId, assessmentVersion: 1, assessmentSnapshot: { title: 'Test', questions: [] }, application: app2.id, candidate: cand2.user.id, company: rec.company.id, assignedBy: rec.user.id, availableFrom: new Date(), expiresAt: new Date(Date.now() + 86400000), status: 'assigned' },
      { assessment: assessmentId, assessmentVersion: 1, assessmentSnapshot: { title: 'Test', questions: [] }, application: app3.id, candidate: cand3.user.id, company: rec.company.id, assignedBy: rec.user.id, availableFrom: new Date(), expiresAt: new Date(Date.now() + 86400000), status: 'assigned' },
    ]);

    // Recruiter promotes candidates
    const promoteRes = await api('post', `/api/v1/assessments/manage/${assessmentId}/promote`, rec.token).send({
      applicationIds: [app1.id, app2.id, app3.id],
      targetStage: 'interview-scheduled',
      reason: 'Top performers in work sample',
    }).expect(200);

    const { summary, details } = promoteRes.body.data;
    expect(summary.requested).toBe(3);
    expect(summary.promoted).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.note).toContain('Meeting date, interviewer, and calendar events must be scheduled separately');

    // Check app1 and app2 were updated to 'interview-scheduled'
    const updatedApp1 = await Application.findById(app1.id);
    expect(updatedApp1.status).toBe('interview-scheduled');
    expect(updatedApp1.statusHistory[updatedApp1.statusHistory.length - 1].reason).toBe('Top performers in work sample');

    const updatedApp2 = await Application.findById(app2.id);
    expect(updatedApp2.status).toBe('interview-scheduled');

    // Check app3 transition failed due to transition constraints
    const app3Detail = details.find((d) => d.applicationId === app3.id);
    expect(app3Detail.status).toBe('failed');
    expect(app3Detail.reason).toContain('cannot transition from submitted to interview-scheduled');

    // Idempotent test: Promoting app1 again reports 'already-in-stage' without error
    const rePromoteRes = await api('post', `/api/v1/assessments/manage/${assessmentId}/promote`, rec.token).send({
      applicationIds: [app1.id],
      targetStage: 'interview-scheduled',
    }).expect(200);

    expect(rePromoteRes.body.data.summary.promoted).toBe(0);
    expect(rePromoteRes.body.data.summary.alreadyInStage).toBe(1);
    expect(rePromoteRes.body.data.details[0].status).toBe('already-in-stage');

    // Check assignment audit trail was recorded
    const assignDoc1 = await AssessmentAssignment.findOne({ application: app1.id, assessment: assessmentId });
    expect(assignDoc1.audit.some((a) => a.action === 'promoted')).toBe(true);
  });

  it('rejects promoting candidates with provisional evaluations unless allowProvisional is set', async () => {
    const rec = await recruiter();
    const createdQ = await api('post', '/api/v1/assessments/questions', rec.token).send(choiceBody('Provisional Q')).expect(201);
    const aRes = await api('post', '/api/v1/assessments', rec.token).send({
      title: 'Provisional Assessment',
      type: 'general',
      durationMinutes: 30,
      passingPercentage: 50,
    }).expect(201);
    const assessmentId = aRes.body.data.assessment._id;
    await api('post', `/api/v1/assessments/manage/${assessmentId}/questions`, rec.token).send({
      questionId: createdQ.body.data.question._id,
      marks: 10,
    }).expect(200);
    await api('patch', `/api/v1/assessments/manage/${assessmentId}/publish`, rec.token).expect(200);

    const cand = await candidate();
    const app = await applicationFor(rec, cand, 'shortlisted');

    // Create an assignment and an attempt in 'review-pending'
    const assign = await AssessmentAssignment.create({
      assessment: assessmentId,
      assessmentVersion: 1,
      assessmentSnapshot: { title: 'Test', questions: [] },
      application: app.id,
      candidate: cand.user.id,
      company: rec.company.id,
      assignedBy: rec.user.id,
      availableFrom: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
      status: 'evaluating',
    });

    const attempt = await AssessmentAttempt.create({
      assignment: assign.id,
      assessment: assessmentId,
      application: app.id,
      candidate: cand.user.id,
      company: rec.company.id,
      attemptNumber: 1,
      status: 'review-pending',
      questionResults: [{ questionId: createdQ.body.data.question._id, requiresManualReview: true }],
    });

    assign.latestAttempt = attempt._id;
    await assign.save();

    // Try promoting without allowProvisional -> should fail for this candidate
    const failRes = await api('post', `/api/v1/assessments/manage/${assessmentId}/promote`, rec.token).send({
      applicationIds: [app.id],
      targetStage: 'interview-scheduled',
    }).expect(200);

    expect(failRes.body.data.summary.promoted).toBe(0);
    expect(failRes.body.data.summary.failed).toBe(1);
    expect(failRes.body.data.details[0].reason).toContain('provisional (manual review pending)');

    // Now promote with allowProvisional: true -> should succeed
    const okRes = await api('post', `/api/v1/assessments/manage/${assessmentId}/promote`, rec.token).send({
      applicationIds: [app.id],
      targetStage: 'interview-scheduled',
      allowProvisional: true,
    }).expect(200);

    expect(okRes.body.data.summary.promoted).toBe(1);
    expect(okRes.body.data.details[0].status).toBe('promoted');
  });
});

