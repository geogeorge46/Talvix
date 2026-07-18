import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { app } from '../src/app.js';
import { Application } from '../src/models/Application.js';
import { CandidateProfile } from '../src/models/CandidateProfile.js';
import { Company } from '../src/models/Company.js';
import { Counter } from '../src/models/Counter.js';
import { Job } from '../src/models/Job.js';
import { RecruiterProfile } from '../src/models/RecruiterProfile.js';
import { User } from '../src/models/User.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { calculateSkillMatch } from '../src/utils/skillMatch.js';

let replicaSet; let sequence = 0;
const auth = (method, path, token) => request(app)[method](path).set('Authorization', `Bearer ${token}`);
const user = async (role) => { sequence += 1; const value = await User.create({ fullName: `${role} ${sequence}`, email: `${role}.${sequence}@ats.test`, password: 'Strong!Pass123', role }); return { user: value, token: generateAccessToken(value.id) }; };
const candidate = async (overrides = {}) => { const account = await user('candidate'); const profile = await CandidateProfile.create({ user: account.user.id, headline: 'Backend Engineer', phone: '+91 99999 99999', profileCompletion: 80, resume: { url: 'https://files.example/resume.pdf', fileName: 'resume.pdf', uploadedAt: new Date() }, skills: [{ name: 'Node.js', proficiency: 'advanced', yearsOfExperience: 4 }], ...overrides }); return { ...account, profile }; };
const recruiterCompany = async (name = 'ATS Labs') => { const account = await user('recruiter'); const company = await Company.create({ name: `${name} ${sequence}`, slug: `ats-${sequence}`, owner: account.user.id, verificationStatus: 'verified', isActive: true, teamMembers: [{ recruiter: account.user.id, role: 'owner', permissions: ['applications.view', 'applications.manage', 'jobs.create', 'jobs.update', 'jobs.delete', 'jobs.publish', 'company.manage', 'team.manage'], status: 'active' }] }); await RecruiterProfile.create({ user: account.user.id, company: company.id, isApproved: true, isCompanyOwner: true, permissions: ['applications.view', 'applications.manage', 'jobs.create', 'jobs.update', 'jobs.delete', 'jobs.publish', 'company.manage', 'team.manage'] }); return { ...account, company }; };
const publishedJob = async (owner, overrides = {}) => Job.create({ company: owner.company.id, createdBy: owner.user.id, title: `Backend Engineer ${sequence}`, slug: `backend-${sequence}-${Math.random().toString(16).slice(2)}`, description: 'Build reliable ATS services.', employmentType: 'full-time', workMode: 'remote', skills: [{ name: 'node.js', required: true, minimumProficiency: 'advanced', minimumYearsOfExperience: 4, weight: 100 }], openings: 1, applicationDeadline: new Date(Date.now() + 86_400_000), status: 'published', publishedAt: new Date(), resumeRequired: true, minimumProfileCompletion: 50, applicationQuestions: [{ question: 'Years available?', type: 'number', required: true }], ...overrides });
const submit = (candidateAccount, job, answer) => auth('post', '/api/v1/applications', candidateAccount.token).send({ jobId: job.id, coverLetter: 'I am interested.', answers: answer === undefined ? [{ questionId: job.applicationQuestions[0].id, answer: 4 }] : answer });

beforeAll(async () => { replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(replicaSet.getUri()); await Promise.all([User.init(), CandidateProfile.init(), RecruiterProfile.init(), Company.init(), Job.init(), Application.init(), Counter.init()]); });
beforeEach(async () => { await Promise.all([User.deleteMany({}), CandidateProfile.deleteMany({}), RecruiterProfile.deleteMany({}), Company.deleteMany({}), Job.deleteMany({}), Application.deleteMany({}), Counter.deleteMany({})]); });
afterAll(async () => { await mongoose.disconnect(); await replicaSet.stop(); });

describe('deterministic skill matching', () => {
  it('normalizes names, weights scores, and reports partial and missing skills', () => {
    const result = calculateSkillMatch([
      { name: 'Node.js', required: true, minimumProficiency: 'advanced', minimumYearsOfExperience: 4, weight: 60 },
      { name: 'MongoDB', required: true, minimumProficiency: 'advanced', minimumYearsOfExperience: 4, weight: 40 },
    ], [{ name: 'NODE.JS', proficiency: 'intermediate', yearsOfExperience: 2 }]);
    expect(result.matchedSkills).toEqual(['Node.js']); expect(result.missingRequiredSkills).toEqual(['MongoDB']);
    expect(result.breakdown[0].score).toBeGreaterThan(30); expect(result.breakdown[0].score).toBeLessThan(100); expect(result.score).toBeGreaterThan(0); expect(result.score).toBeLessThan(60);
    expect(calculateSkillMatch([{ name: 'Node.js', required: true, minimumProficiency: 'advanced', minimumYearsOfExperience: 4, weight: 100 }], [{ name: 'node.js', proficiency: 'expert', yearsOfExperience: 5 }]).score).toBe(100);
  });
});

describe('application submission and consistency', () => {
  it('submits once, stores safe snapshots, scores skills, and increments the job counter', async () => {
    const owner = await recruiterCompany(); const applicant = await candidate(); const job = await publishedJob(owner);
    const response = await submit(applicant, job).expect(201); const application = response.body.data.application;
    expect(application.applicationNumber).toMatch(/^TVX-APP-\d{4}-\d{6}$/); expect(application.skillMatch.score).toBe(100);
    expect(application.candidateSnapshot.fullName).toBe(applicant.user.fullName); expect(application.candidateSnapshot.password).toBeUndefined();
    expect((await Job.findById(job.id)).applicationsCount).toBe(1);
    await submit(applicant, job).expect(409); expect((await Job.findById(job.id)).applicationsCount).toBe(1);
    await submit(owner, job).expect(403);
  });

  it('validates questions and preserves the counter on failed submissions', async () => {
    const owner = await recruiterCompany(); const applicant = await candidate(); const job = await publishedJob(owner);
    await submit(applicant, job, []).expect(400);
    await submit(applicant, job, [{ questionId: new mongoose.Types.ObjectId().toString(), answer: 4 }]).expect(400);
    await submit(applicant, job, [{ questionId: job.applicationQuestions[0].id, answer: 'four' }]).expect(400);
    expect((await Job.findById(job.id)).applicationsCount).toBe(0); expect(await Application.countDocuments()).toBe(0);
  });

  it('enforces resume, profile completion, job state, deadline, and company eligibility', async () => {
    const owner = await recruiterCompany(); const noResume = await candidate({ resume: {}, profileCompletion: 20 }); const job = await publishedJob(owner);
    await submit(noResume, job).expect(400);
    noResume.profile.resume = { url: 'https://files.example/r.pdf', fileName: 'r.pdf' }; await noResume.profile.save(); await submit(noResume, job).expect(400);
    noResume.profile.profileCompletion = 80; await noResume.profile.save(); job.status = 'paused'; await job.save(); await submit(noResume, job).expect(404);
    job.status = 'published'; job.applicationDeadline = new Date(Date.now() - 1000); await job.save(); await submit(noResume, job).expect(404);
    job.applicationDeadline = new Date(Date.now() + 86_400_000); await job.save(); owner.company.verificationStatus = 'suspended'; await owner.company.save(); await submit(noResume, job).expect(404);
  });

  it('allows only one concurrent duplicate submission and generates unique numbers', async () => {
    const owner = await recruiterCompany(); const first = await candidate(); const second = await candidate(); const job = await publishedJob(owner);
    const duplicateResults = await Promise.all([submit(first, job), submit(first, job)]); expect(duplicateResults.map((item) => item.status).sort()).toEqual([201, 409]);
    await submit(second, job).expect(201); const applications = await Application.find(); expect(new Set(applications.map((item) => item.applicationNumber)).size).toBe(2); expect((await Job.findById(job.id)).applicationsCount).toBe(2);
  });
});

describe('candidate and recruiter access', () => {
  it('keeps candidate views private, refreshes snapshots, returns timeline, and withdraws legally', async () => {
    const owner = await recruiterCompany(); const first = await candidate(); const second = await candidate(); const job = await publishedJob(owner);
    const created = await submit(first, job).expect(201); const id = created.body.data.application._id;
    const stored = await Application.findById(id); stored.recruiterNotes.push({ author: owner.user.id, note: 'Private' }); stored.recruiterRating = 5; stored.tags = ['priority']; stored.assignedRecruiters = [owner.user.id]; await stored.save();
    const detail = await auth('get', `/api/v1/applications/me/${id}`, first.token).expect(200); const visible = detail.body.data.application;
    expect(visible.recruiterNotes).toBeUndefined(); expect(visible.recruiterRating).toBeUndefined(); expect(visible.tags).toBeUndefined(); expect(visible.assignedRecruiters).toBeUndefined();
    await auth('get', `/api/v1/applications/me/${id}`, second.token).expect(404);
    first.profile.skills[0].proficiency = 'expert'; await first.profile.save(); await auth('patch', `/api/v1/applications/me/${id}/refresh-snapshot`, first.token).expect(200);
    expect((await auth('get', `/api/v1/applications/me/${id}/timeline`, first.token).expect(200)).body.data.timeline).toHaveLength(1);
    await auth('patch', `/api/v1/applications/me/${id}/withdraw`, first.token).send({ reason: 'Accepted another role' }).expect(200);
    await auth('patch', `/api/v1/applications/me/${id}/withdraw`, first.token).send({ reason: 'Again' }).expect(409);
    await auth('patch', `/api/v1/applications/me/${id}/refresh-snapshot`, first.token).expect(409);
  });

  it('enforces company scope and permissions while supporting ATS operations', async () => {
    const owner = await recruiterCompany(); const outsider = await recruiterCompany('Other'); const applicant = await candidate(); const job = await publishedJob(owner); const created = await submit(applicant, job).expect(201); const id = created.body.data.application._id;
    await auth('get', `/api/v1/applications/manage/${id}`, outsider.token).expect(404);
    await auth('patch', `/api/v1/applications/manage/${id}/status`, owner.token).send({ status: 'hired' }).expect(409);
    await auth('patch', `/api/v1/applications/manage/${id}/status`, owner.token).send({ status: 'under-review', reason: 'Good fit' }).expect(200);
    const note = await auth('post', `/api/v1/applications/manage/${id}/notes`, owner.token).send({ note: 'Strong profile' }).expect(201);
    await auth('patch', `/api/v1/applications/manage/${id}/notes/${note.body.data.note._id}`, owner.token).send({ note: 'Very strong profile' }).expect(200);
    await auth('patch', `/api/v1/applications/manage/${id}/rating`, owner.token).send({ rating: 6 }).expect(400);
    await auth('patch', `/api/v1/applications/manage/${id}/rating`, owner.token).send({ rating: 4 }).expect(200);
    const tagged = await auth('patch', `/api/v1/applications/manage/${id}/tags`, owner.token).send({ tags: ['Priority', 'priority', 'strong-nodejs'] }).expect(200); expect(tagged.body.data.application.tags).toEqual(['priority', 'strong-nodejs']);
    await auth('patch', `/api/v1/applications/manage/${id}/assignees`, owner.token).send({ recruiterIds: [outsider.user.id] }).expect(400);
    const pipeline = await auth('get', '/api/v1/applications/manage/pipeline', owner.token).expect(200); expect(pipeline.body.data.pipeline['under-review']).toBe(1);
    const statistics = await auth('get', `/api/v1/applications/manage/jobs/${job.id}/statistics`, owner.token).expect(200); expect(statistics.body.data.statistics.total).toBe(1); expect(statistics.body.data.statistics.averageMatchScore).toBe(100);
    await auth('delete', `/api/v1/applications/manage/${id}/notes/${note.body.data.note._id}`, owner.token).expect(200);
  });
});

describe('administration', () => {
  it('requires admin access and a reason, audits overrides, and archives records', async () => {
    const owner = await recruiterCompany(); const applicant = await candidate(); const administrator = await user('admin'); const job = await publishedJob(owner); const created = await submit(applicant, job).expect(201); const id = created.body.data.application._id;
    await auth('get', '/api/v1/applications/admin', owner.token).expect(403);
    await auth('patch', `/api/v1/applications/admin/${id}/status`, administrator.token).send({ status: 'shortlisted' }).expect(400);
    await auth('patch', `/api/v1/applications/admin/${id}/status`, administrator.token).send({ status: 'shortlisted', reason: 'Support correction' }).expect(200);
    const audited = await Application.findById(id); expect(audited.statusHistory.at(-1).adminOverride).toBe(true); expect(audited.statusHistory.at(-1).changedBy.toString()).toBe(administrator.user.id);
    await auth('patch', `/api/v1/applications/admin/${id}/archive`, administrator.token).expect(200);
    expect((await auth('get', '/api/v1/applications/admin', administrator.token).expect(200)).body.data.pagination.total).toBe(0);
    expect((await auth('get', '/api/v1/applications/admin?archived=true', administrator.token).expect(200)).body.data.pagination.total).toBe(1);
  });
});
