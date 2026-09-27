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
import { Document } from '../src/models/Document.js';
import { FileUploadSession } from '../src/models/FileUploadSession.js';
import { StorageReservation } from '../src/models/StorageReservation.js';
import { UserStorageUsage } from '../src/models/UserStorageUsage.js';
import { resetMemoryStorage } from '../src/services/fileStorageProvider.service.js';
import { generateAccessToken } from '../src/utils/jwt.js';

let replicaSet;
let sequence = 0;
const permissions = ['assessments.view', 'assessments.manage', 'assessments.assign', 'assessments.review', 'documents.view'];
const api = (method, path, token) => request(app)[method](path).set('Authorization', `Bearer ${token}`);
const account = async (role) => { sequence += 1; const user = await User.create({ fullName: `${role} ${sequence}`, email: `${role}.${sequence}@ws.test`, password: 'Strong!Pass123', role }); return { user, token: generateAccessToken(user.id) }; };
const recruiter = async () => { const owner = await account('recruiter'); const company = await Company.create({ name: `WS Co ${sequence}`, slug: `ws-co-${sequence}`, owner: owner.user.id, verificationStatus: 'verified', isActive: true, teamMembers: [{ recruiter: owner.user.id, role: 'owner', permissions, status: 'active' }] }); await RecruiterProfile.create({ user: owner.user.id, company: company.id, isApproved: true, isCompanyOwner: true, permissions }); return { ...owner, company }; };
const candidate = async () => account('candidate');
const applicationFor = async (owner, cand) => Application.create({ candidate: cand.user.id, candidateProfile: new mongoose.Types.ObjectId(), job: new mongoose.Types.ObjectId(), company: owner.company.id, applicationNumber: `TVX-WS-${sequence}-${Date.now()}`, status: 'shortlisted', candidateSnapshot: { fullName: cand.user.fullName }, jobSnapshot: { title: 'Designer' }, skillMatch: { score: 0, matchedSkills: [], missingRequiredSkills: [], breakdown: [] } });

const workSampleQuestionBody = () => ({
  type: 'work-sample',
  prompt: 'Design a mobile checkout flow for an e-commerce app.',
  difficulty: 'medium',
  defaultMarks: 90,
  skills: ['ui-design'],
  deliverable: {
    type: 'mixed',
    instructions: 'Upload your Figma file and paste the shareable link.',
    allowedFormats: ['.pdf', '.fig'],
    maxFiles: 3,
    maxFileSizeBytes: 20 * 1024 * 1024,
    referenceAssets: [{ name: 'Brand Guide', url: 'https://example.com/brand.pdf', description: 'Brand colors' }],
  },
  rubric: {
    criteria: [
      { name: 'Visual Design', description: 'Layout and color', maxMarks: 40, weight: 45 },
      { name: 'User Flow Logic', description: 'Navigation', maxMarks: 30, weight: 33 },
      { name: 'Accessibility', description: 'WCAG', maxMarks: 20, weight: 22 },
    ],
    evaluationNotes: 'Check Figma layer naming.',
  },
});

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replicaSet.getUri());
  await Promise.all([User.init(), RecruiterProfile.init(), Company.init(), Application.init(), Question.init(), Assessment.init(), AssessmentAssignment.init(), AssessmentAttempt.init(), Document.init(), FileUploadSession.init(), UserStorageUsage.init(), StorageReservation.init()]);
});
beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
  resetMemoryStorage();
});
afterAll(async () => { await mongoose.disconnect(); await replicaSet.stop(); });

// ─── 1. Question validation ──────────────────────────────────────────────────
describe('Work Sample — question validation', () => {
  it('creates work-sample question with valid deliverable and rubric', async () => {
    const owner = await recruiter();
    const res = await api('post', '/api/v1/assessments/questions', owner.token).send(workSampleQuestionBody()).expect(201);
    expect(res.body.data.question.type).toBe('work-sample');
    expect(res.body.data.question.deliverable.instructions).toBeDefined();
    expect(res.body.data.question.rubric.criteria).toHaveLength(3);
    expect(res.body.data.question.rubric.evaluationNotes).toBe('Check Figma layer naming.');
  });

  it('rejects work-sample missing deliverable (400)', async () => {
    const owner = await recruiter();
    const body = workSampleQuestionBody();
    delete body.deliverable;
    await api('post', '/api/v1/assessments/questions', owner.token).send(body).expect(400);
  });

  it('rejects work-sample missing rubric (400)', async () => {
    const owner = await recruiter();
    const body = workSampleQuestionBody();
    delete body.rubric;
    await api('post', '/api/v1/assessments/questions', owner.token).send(body).expect(400);
  });

  it('rejects rubric weights not summing to 100 (400)', async () => {
    const owner = await recruiter();
    const body = workSampleQuestionBody();
    body.rubric.criteria[0].weight = 80; // sum becomes 135, not 100
    await api('post', '/api/v1/assessments/questions', owner.token).send(body).expect(400);
  });

  it('rejects work-sample with correctAnswer (400)', async () => {
    const owner = await recruiter();
    const body = { ...workSampleQuestionBody(), correctAnswer: { optionId: 'abc' } };
    await api('post', '/api/v1/assessments/questions', owner.token).send(body).expect(400);
  });

  it('rejects file deliverable with maxFiles < 1 (400)', async () => {
    const owner = await recruiter();
    const body = workSampleQuestionBody();
    body.deliverable.type = 'file';
    body.deliverable.maxFiles = 0;
    await api('post', '/api/v1/assessments/questions', owner.token).send(body).expect(400);
  });

  it('cross-company: other recruiter cannot view question (404)', async () => {
    const owner = await recruiter();
    const other = await recruiter();
    const res = await api('post', '/api/v1/assessments/questions', owner.token).send(workSampleQuestionBody()).expect(201);
    const qId = res.body.data.question._id;
    await api('get', `/api/v1/assessments/questions/${qId}`, other.token).expect(404);
  });
});

// ─── 2. Assessment accepts durationMinutes > 300 ─────────────────────────────
describe('Work Sample — extended durationMinutes', () => {
  it('accepts durationMinutes 480 (above old max of 300)', async () => {
    const owner = await recruiter();
    const res = await api('post', '/api/v1/assessments', owner.token)
      .send({ title: 'Long WS', type: 'work-sample', durationMinutes: 480, passingPercentage: 60 })
      .expect(201);
    expect(res.body.data.assessment.durationMinutes).toBe(480);
  });

  it('rejects durationMinutes > 1440 (400)', async () => {
    const owner = await recruiter();
    await api('post', '/api/v1/assessments', owner.token)
      .send({ title: 'Too Long', type: 'work-sample', durationMinutes: 1441, passingPercentage: 60 })
      .expect(400);
  });
});

// ─── 3. Full flow: snapshot + attempt + rubric scoring ───────────────────────
describe('Work Sample — full attempt and rubric scoring', () => {
  it('snapshot freezes rubric/deliverable, candidate view strips evaluationNotes, rubric scoring calculates weighted marks, result exposes criterion breakdown', async () => {
    const owner = await recruiter();
    const cand = await candidate();
    const application = await applicationFor(owner, cand);

    // Create question with rubric weights: Research(33) + Channels(34) + KPIs(33) = 100
    const qRes = await api('post', '/api/v1/assessments/questions', owner.token).send({
      type: 'work-sample',
      prompt: 'Create a marketing campaign strategy.',
      difficulty: 'hard',
      defaultMarks: 90,
      deliverable: { type: 'text', instructions: 'Write your strategy in the text box.' },
      rubric: {
        criteria: [
          { name: 'Market Research', maxMarks: 30, weight: 33 },
          { name: 'Campaign Channels', maxMarks: 30, weight: 34 },
          { name: 'KPIs', maxMarks: 30, weight: 33 },
        ],
        evaluationNotes: 'Look for measurable KPIs.',
      },
    }).expect(201);
    const questionId = qRes.body.data.question._id;

    // Create and publish assessment
    const aRes = await api('post', '/api/v1/assessments', owner.token)
      .send({ title: 'Marketing WS', type: 'work-sample', durationMinutes: 180, passingPercentage: 60 }).expect(201);
    const assessmentId = aRes.body.data.assessment._id;
    await api('post', `/api/v1/assessments/manage/${assessmentId}/questions`, owner.token)
      .send({ questionId, marks: 90, order: 0, isRequired: true }).expect(200);
    await api('patch', `/api/v1/assessments/manage/${assessmentId}/publish`, owner.token).expect(200);

    // Assign
    const now = new Date();
    const assignRes = await api('post', '/api/v1/assessments/assignments', owner.token).send({
      assessmentId, applicationId: application._id.toString(),
      availableFrom: now, expiresAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
    }).expect(201);
    const assignmentId = assignRes.body.data.assignment._id;

    // Verify snapshot contains rubric and deliverable
    const snapRes = await api('get', `/api/v1/assessments/assignments/manage/${assignmentId}`, owner.token).expect(200);
    const sq = snapRes.body.data.assignment.assessmentSnapshot?.questions?.[0];
    expect(sq?.rubric?.criteria).toHaveLength(3);
    expect(sq?.deliverable?.type).toBe('text');

    // Candidate starts attempt
    const startRes = await api('post', `/api/v1/assessments/assignments/me/${assignmentId}/start`, cand.token).expect(201);
    const attemptId = startRes.body.data.attempt.id ?? startRes.body.data.attempt._id;
    const attemptQ = startRes.body.data.attempt.questions?.[0];

    // Candidate sees deliverable + rubricCriteria, NOT evaluationNotes or rubric object
    expect(attemptQ.type).toBe('work-sample');
    expect(attemptQ.deliverable?.instructions).toBeDefined();
    expect(attemptQ.rubricCriteria).toHaveLength(3);
    expect(attemptQ.rubricCriteria[0]).toHaveProperty('name');
    expect(attemptQ.rubricCriteria[0]).toHaveProperty('weight');
    expect(attemptQ.rubric).toBeUndefined();
    expect(attemptQ.correctAnswer).toBeUndefined();

    const qIdInAttempt = attemptQ.questionId;

    // Candidate saves answer with submittedUrls
    await api('patch', `/api/v1/assessments/attempts/me/${attemptId}/answers`, cand.token).send({
      questionId: qIdInAttempt,
      answer: 'Target Gen-Z via TikTok with influencer campaigns...',
      submittedUrls: ['https://docs.google.com/spreadsheets/d/example'],
      timeSpentSeconds: 3600,
    }).expect(200);

    // Candidate submits
    const submitRes = await api('post', `/api/v1/assessments/attempts/me/${attemptId}/submit`, cand.token).expect(200);
    expect(submitRes.body.data.attempt.status).toBe('review-pending');

    // Result withheld before review
    await api('get', `/api/v1/assessments/attempts/me/${attemptId}/result`, cand.token).expect(409); // 409 when attempt status is review-pending (not yet completed)

    // Recruiter: reject unknown criterion
    await api('patch', `/api/v1/assessments/reviews/${attemptId}/questions/${qIdInAttempt}`, owner.token)
      .send({ rubricScores: [{ criterionName: 'NonExistent', awardedMarks: 20 }] }).expect(400);

    // Recruiter: reject score exceeding maxMarks
    await api('patch', `/api/v1/assessments/reviews/${attemptId}/questions/${qIdInAttempt}`, owner.token).send({
      rubricScores: [
        { criterionName: 'Market Research', awardedMarks: 999 },
        { criterionName: 'Campaign Channels', awardedMarks: 25 },
        { criterionName: 'KPIs', awardedMarks: 20 },
      ],
    }).expect(400);

    // Recruiter: reject incomplete criteria
    await api('patch', `/api/v1/assessments/reviews/${attemptId}/questions/${qIdInAttempt}`, owner.token)
      .send({ rubricScores: [{ criterionName: 'Market Research', awardedMarks: 25 }] }).expect(400);

    // Recruiter scores with rubric
    // Research:25/30*w33 + Channels:30/30*w34 + KPIs:20/30*w33
    // weightedSum = (33*25/30)+(34*30/30)+(33*20/30) = 27.5+34+22 = 83.5
    // awardedMarks = round(90 * 83.5/100, 2) = 75.15
    const scoreRes = await api('patch', `/api/v1/assessments/reviews/${attemptId}/questions/${qIdInAttempt}`, owner.token).send({
      rubricScores: [
        { criterionName: 'Market Research', awardedMarks: 25, feedback: 'Good but missing competitor analysis' },
        { criterionName: 'Campaign Channels', awardedMarks: 30, feedback: 'Excellent mix' },
        { criterionName: 'KPIs', awardedMarks: 20, feedback: 'Need measurable KPIs' },
      ],
      feedback: 'Strong direction overall.',
    }).expect(200);
    expect(scoreRes.body.data.result.requiresManualReview).toBe(false);
    expect(scoreRes.body.data.result.rubricScores).toHaveLength(3);
    expect(scoreRes.body.data.result.awardedMarks).toBeCloseTo(75.15, 1);

    // Complete review
    const completeRes = await api('patch', `/api/v1/assessments/reviews/${attemptId}/complete`, owner.token)
      .send({}).expect(200);
    expect(completeRes.body.data.attempt.status).toBe('completed');
    // 75.15/90 totalMarks = 83.5%
    expect(completeRes.body.data.attempt.evaluation.percentage).toBeCloseTo(83.5, 0);
    expect(completeRes.body.data.attempt.evaluation.passed).toBe(true);

    // Release result
    await api('patch', `/api/v1/assessments/assignments/manage/${assignmentId}/release-result`, owner.token).expect(200);

    // Candidate sees rubric breakdown — per-criterion feedback stripped
    const resultRes = await api('get', `/api/v1/assessments/attempts/me/${attemptId}/result`, cand.token).expect(200);
    const qResult = resultRes.body.data.result.questionResults?.[0];
    expect(qResult).toBeDefined();
    expect(qResult.rubricScores).toHaveLength(3);
    expect(qResult.rubricScores[0]).toHaveProperty('criterionName');
    expect(qResult.rubricScores[0]).toHaveProperty('awardedMarks');
    expect(qResult.rubricScores[0]).toHaveProperty('maxMarks');
    expect(qResult.rubricScores[0].feedback).toBeUndefined(); // stripped
    expect(JSON.stringify(resultRes.body)).not.toContain('evaluationNotes');
    expect(JSON.stringify(resultRes.body)).not.toContain('correctAnswer');
  });

  it('supports untimed multi-day assignment (durationMinutes: 0) and accurately computes unequal rubric weights with different max marks', async () => {
    const owner = await recruiter();
    const cand = await candidate();
    const application = await applicationFor(owner, cand);

    // Unequal weights: Technical (weight 70, maxMarks 20), Presentation (weight 30, maxMarks 10)
    const qRes = await api('post', '/api/v1/assessments/questions', owner.token).send({
      type: 'work-sample',
      prompt: 'Refactor and explain this system architecture.',
      difficulty: 'hard',
      defaultMarks: 100,
      deliverable: { type: 'text', instructions: 'Submit architectural breakdown.' },
      rubric: {
        criteria: [
          { name: 'Technical Depth', maxMarks: 20, weight: 70 },
          { name: 'Clarity & Presentation', maxMarks: 10, weight: 30 },
        ],
        evaluationNotes: 'Private recruiter grading guide.',
      },
    }).expect(201);
    const questionId = qRes.body.data.question._id;

    // Untimed assessment: durationMinutes = 0
    const aRes = await api('post', '/api/v1/assessments', owner.token)
      .send({ title: 'Architect Take-Home', type: 'work-sample', durationMinutes: 0, passingPercentage: 70 }).expect(201);
    const assessmentId = aRes.body.data.assessment._id;
    await api('post', `/api/v1/assessments/manage/${assessmentId}/questions`, owner.token)
      .send({ questionId, marks: 100, order: 0, isRequired: true }).expect(200);
    await api('patch', `/api/v1/assessments/manage/${assessmentId}/publish`, owner.token).expect(200);

    // Multi-day deadline: 5 days from now
    const now = new Date();
    const deadline = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    const assignRes = await api('post', '/api/v1/assessments/assignments', owner.token).send({
      assessmentId, applicationId: application._id.toString(),
      availableFrom: now, expiresAt: deadline,
    }).expect(201);
    const assignmentId = assignRes.body.data.assignment._id;

    // Candidate starts attempt: attempt.expiresAt must equal assignment deadline (not 0 or 60 min)
    const startRes = await api('post', `/api/v1/assessments/assignments/me/${assignmentId}/start`, cand.token).expect(201);
    const attemptId = startRes.body.data.attempt.id ?? startRes.body.data.attempt._id;
    const attemptExpiresAt = new Date(startRes.body.data.attempt.expiresAt);
    expect(Math.abs(attemptExpiresAt.getTime() - deadline.getTime())).toBeLessThan(5000);

    // Candidate saves draft in session 1
    const attemptQ = startRes.body.data.attempt.questions[0];
    await api('patch', `/api/v1/assessments/attempts/me/${attemptId}/answers`, cand.token).send({
      questionId: attemptQ.questionId,
      answer: 'Draft architecture response part 1',
    }).expect(200);

    // Candidate reopens attempt later (session recovery)
    const getAttempt = await api('get', `/api/v1/assessments/attempts/me/${attemptId}`, cand.token).expect(200);
    const savedAnswer = getAttempt.body.data.attempt.answers.find((a) => a.questionId === attemptQ.questionId);
    expect(savedAnswer.answer).toBe('Draft architecture response part 1');

    // Update draft and submit
    await api('patch', `/api/v1/assessments/attempts/me/${attemptId}/answers`, cand.token).send({
      questionId: attemptQ.questionId,
      answer: 'Final architecture response with all components detailed',
    }).expect(200);
    await api('post', `/api/v1/assessments/attempts/me/${attemptId}/submit`, cand.token).expect(200);

    // Recruiter scores with unequal weights and different max marks:
    // Technical: 15 / 20 (75%) * 70% weight = 52.5%
    // Clarity: 10 / 10 (100%) * 30% weight = 30%
    // Sum = 82.5% of 100 marks = 82.5 marks
    const scoreRes = await api('patch', `/api/v1/assessments/reviews/${attemptId}/questions/${attemptQ.questionId}`, owner.token).send({
      rubricScores: [
        { criterionName: 'Technical Depth', awardedMarks: 15, feedback: 'Strong depth' },
        { criterionName: 'Clarity & Presentation', awardedMarks: 10, feedback: 'Very clear' },
      ],
      feedback: 'Great submission overall.',
    }).expect(200);
    expect(scoreRes.body.data.result.awardedMarks).toBeCloseTo(82.5, 2);

    await api('patch', `/api/v1/assessments/reviews/${attemptId}/complete`, owner.token).send({}).expect(200);
    await api('patch', `/api/v1/assessments/assignments/manage/${assignmentId}/release-result`, owner.token).expect(200);

    // Candidate checks result: rubric scores visible, recruiter internal notes hidden
    const resultRes = await api('get', `/api/v1/assessments/attempts/me/${attemptId}/result`, cand.token).expect(200);
    expect(resultRes.body.data.result.score).toBeCloseTo(82.5, 2);
    expect(resultRes.body.data.result.questionResults[0].rubricScores).toEqual([
      { criterionName: 'Technical Depth', awardedMarks: 15, maxMarks: 20 },
      { criterionName: 'Clarity & Presentation', awardedMarks: 10, maxMarks: 10 },
    ]);
    expect(JSON.stringify(resultRes.body)).not.toContain('Private recruiter grading guide');
  });

  it('supports candidate deliverable file upload and candidate/recruiter download for work-sample questions', async () => {
    const owner = await recruiter();
    const cand = await candidate();
    const application = await applicationFor(owner, cand);

    // Create question with file deliverable
    const qRes = await api('post', '/api/v1/assessments/questions', owner.token).send({
      type: 'work-sample',
      prompt: 'Submit your code review document as a PDF.',
      difficulty: 'medium',
      defaultMarks: 50,
      deliverable: {
        type: 'file',
        instructions: 'Upload your written review.',
        allowedFormats: ['pdf'],
        maxFiles: 2,
        maxFileSizeBytes: 5 * 1024 * 1024,
      },
      rubric: {
        criteria: [{ name: 'Code Quality', maxMarks: 50, weight: 100 }],
      },
    }).expect(201);
    const questionId = qRes.body.data.question._id;

    // Assessment with attachments not explicitly configured on assessment level
    // (fallback takes deliverable config from work-sample question snapshot)
    const aRes = await api('post', '/api/v1/assessments', owner.token)
      .send({ title: 'Code Review WS', type: 'work-sample', durationMinutes: 120, passingPercentage: 60 }).expect(201);
    const assessmentId = aRes.body.data.assessment._id;
    await api('post', `/api/v1/assessments/manage/${assessmentId}/questions`, owner.token)
      .send({ questionId, marks: 50, order: 0, isRequired: true }).expect(200);
    await api('patch', `/api/v1/assessments/manage/${assessmentId}/publish`, owner.token).expect(200);

    const now = new Date();
    const assignRes = await api('post', '/api/v1/assessments/assignments', owner.token).send({
      assessmentId, applicationId: application._id.toString(),
      availableFrom: now, expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    }).expect(201);
    const assignmentId = assignRes.body.data.assignment._id;

    // Candidate starts attempt
    const startRes = await api('post', `/api/v1/assessments/assignments/me/${assignmentId}/start`, cand.token).expect(201);
    const attemptId = startRes.body.data.attempt.id ?? startRes.body.data.attempt._id;

    // Candidate creates upload session
    const sessionRes = await api('post', '/api/v1/documents/upload-session', cand.token).send({
      category: 'assessment-attachment',
      entityType: 'assessment-attempt',
      entityId: String(attemptId),
      purpose: 'Work sample PDF deliverable',
    }).expect(201);
    const uploadSessionId = sessionRes.body.data.uploadSession.id;

    // Candidate uploads PDF
    const uploadRes = await api('post', `/api/v1/documents/assessments/attempts/${attemptId}`, cand.token)
      .field('uploadSessionId', uploadSessionId)
      .field('purpose', 'Work sample PDF deliverable')
      .attach('file', Buffer.from('%PDF-1.4\nWork sample deliverable content'), {
        filename: 'submission.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    const documentId = uploadRes.body.data.document.id;
    expect(documentId).toBeDefined();

    // Candidate lists uploaded attempt documents
    const listRes = await api('get', `/api/v1/documents/assessments/attempts/${attemptId}`, cand.token).expect(200);
    expect(listRes.body.data.documents).toHaveLength(1);
    expect(listRes.body.data.documents[0].displayName).toBe('Work sample PDF deliverable');

    // Candidate downloads their uploaded attempt document
    const candDownload = await api('get', `/api/v1/documents/assessments/attempts/${attemptId}/${documentId}/download`, cand.token).expect(200);
    expect(candDownload.body.data.url).toBeDefined();

    // Recruiter lists and downloads the attempt document
    const recruiterList = await api('get', `/api/v1/documents/manage/assessments/attempts/${attemptId}`, owner.token).expect(200);
    expect(recruiterList.body.data.documents).toHaveLength(1);

    const recruiterDownload = await api('get', `/api/v1/documents/manage/assessments/attempts/${attemptId}/${documentId}/download`, owner.token).expect(200);
    expect(recruiterDownload.body.data.url).toBeDefined();
  });
});
