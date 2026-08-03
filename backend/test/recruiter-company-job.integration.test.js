import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { app } from '../src/app.js';
import { CandidateProfile } from '../src/models/CandidateProfile.js';
import { Company } from '../src/models/Company.js';
import { CompanyMember } from '../src/models/CompanyMember.js';
import { Job } from '../src/models/Job.js';
import { RecruiterProfile } from '../src/models/RecruiterProfile.js';
import { User } from '../src/models/User.js';
import { generateAccessToken } from '../src/utils/jwt.js';

let replicaSet;
let sequence = 0;
const auth = (method, path, token) => request(app)[method](path).set('Authorization', `Bearer ${token}`);
const register = async (role = 'recruiter') => {
  sequence += 1;
  const response = await request(app).post('/api/v1/auth/register').send({ fullName: `${role} ${sequence}`, email: `${role}.${sequence}@business.test`, password: 'Strong!Pass123', role }).expect(201);
  return { user: response.body.data.user, token: response.body.data.accessToken };
};
const admin = async () => { sequence += 1; const user = await User.create({ fullName: 'Admin User', email: `admin.${sequence}@business.test`, password: 'Strong!Pass123', role: 'admin' }); return { user, token: generateAccessToken(user.id) }; };
const approve = async (recruiter, adminAccount) => { const profile = await RecruiterProfile.findOne({ user: recruiter.user._id }); await auth('patch', `/api/v1/recruiters/admin/${profile.id}/approve`, adminAccount.token).send({}).expect(200); return profile; };
const createVerifiedCompany = async (recruiter, adminAccount, name = 'Talvix Labs') => {
  await approve(recruiter, adminAccount);
  const created = await auth('post', '/api/v1/companies', recruiter.token).send({ name, industry: 'Technology', companySize: '11-50' }).expect(201);
  await auth('patch', `/api/v1/companies/admin/${created.body.data.company._id}/verify`, adminAccount.token).send({ notes: 'Documents verified' }).expect(200);
  const updatedUser = await User.findById(recruiter.user._id);
  recruiter.token = generateAccessToken(updatedUser.id, [updatedUser.role], updatedUser.tokenVersion);
  return created.body.data.company;
};
const validJob = () => ({ title: 'Backend Engineer', description: 'Build reliable recruitment services.', employmentType: 'full-time', workMode: 'remote', skills: [{ name: 'Node.js', required: true, minimumProficiency: 'advanced', minimumYearsOfExperience: 3, weight: 80 }], salary: { minimum: 80000, maximum: 120000, currency: 'USD', period: 'yearly', isVisible: false }, minimumExperience: 2, maximumExperience: 6, openings: 2, applicationDeadline: new Date(Date.now() + 7 * 86_400_000).toISOString() });

beforeAll(async () => { replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(replicaSet.getUri()); await Promise.all([User.init(), CandidateProfile.init(), RecruiterProfile.init(), Company.init(), Job.init(), CompanyMember.init()]); });
beforeEach(async () => { await Promise.all([User.deleteMany({}), CandidateProfile.deleteMany({}), RecruiterProfile.deleteMany({}), Company.deleteMany({}), Job.deleteMany({}), CompanyMember.deleteMany({})]); });
afterAll(async () => { await mongoose.disconnect(); await replicaSet.stop(); });

describe('recruiter registration and approval', () => {
  it('creates only secure role profiles and protects approval fields', async () => {
    const recruiter = await register(); const candidate = await register('candidate');
    const profile = await RecruiterProfile.findOne({ user: recruiter.user._id });
    expect(profile).toMatchObject({ isApproved: false, permissions: [], isCompanyOwner: false });
    expect(await RecruiterProfile.exists({ user: candidate.user._id })).toBeNull();
    await auth('patch', '/api/v1/recruiters/me', recruiter.token).send({ isApproved: true, permissions: ['company.manage'] }).expect(400);
    const updated = await auth('patch', '/api/v1/recruiters/me', recruiter.token).send({ designation: 'Talent Partner', bio: 'Skills-first recruiter.' }).expect(200);
    expect(updated.body.data.profile.designation).toBe('Talent Partner');
  });

  it('permits only admins to approve recruiters and records the admin', async () => {
    const recruiter = await register(); const other = await register(); const profile = await RecruiterProfile.findOne({ user: recruiter.user._id });
    await auth('patch', `/api/v1/recruiters/admin/${profile.id}/approve`, other.token).send({}).expect(403);
    const administrator = await admin(); await approve(recruiter, administrator);
    const approved = await RecruiterProfile.findById(profile.id); expect(approved.isApproved).toBe(true); expect(approved.approvedBy.toString()).toBe(administrator.user.id);
  });
});

describe('company ownership, permissions, and verification', () => {
  it('requires approval, creates a pending company once, and assigns owner permissions', async () => {
    const recruiter = await register(); const administrator = await admin();
    await auth('post', '/api/v1/companies', recruiter.token).send({ name: 'Pending Labs' }).expect(403);
    await approve(recruiter, administrator);
    const response = await auth('post', '/api/v1/companies', recruiter.token).send({ name: 'Pending Labs' }).expect(201);
    const company = await Company.findById(response.body.data.company._id);
    expect(company.verificationStatus).toBe('pending'); expect(company.owner.toString()).toBe(recruiter.user._id);
    const ownerMember = await CompanyMember.findOne({ company: company._id, recruiter: recruiter.user._id });
    expect(ownerMember.role).toBe('provisional_admin');
    expect((await RecruiterProfile.findOne({ user: recruiter.user._id })).permissions).toContain('company.manage');
    await auth('post', '/api/v1/companies', recruiter.token).send({ name: 'Second Company' }).expect(409);
    await auth('patch', `/api/v1/companies/admin/${company.id}/verify`, recruiter.token).send({}).expect(403);
  });

  it('enforces team permissions and prevents owner removal', async () => {
    const administrator = await admin(); const owner = await register(); const member = await register();
    const company = await createVerifiedCompany(owner, administrator); await approve(member, administrator);
    const added = await auth('post', '/api/v1/companies/me/team', owner.token).send({ recruiterId: member.user._id, role: 'sourcer', permissions: [] }).expect(201);
    const addedUser = await User.findById(member.user._id);
    member.token = generateAccessToken(addedUser.id, [addedUser.role], addedUser.tokenVersion);
    await auth('patch', '/api/v1/companies/me', member.token).send({ description: 'Forbidden' }).expect(403);
    await auth('patch', `/api/v1/companies/me/team/${added.body.data.member._id}`, owner.token).send({ permissions: ['company.manage'] }).expect(200);
    const updatedMember = await User.findById(member.user._id);
    member.token = generateAccessToken(updatedMember.id, [updatedMember.role], updatedMember.tokenVersion);
    await auth('patch', '/api/v1/companies/me', member.token).send({ description: 'Allowed' }).expect(200);
    const ownerMember = await CompanyMember.findOne({ company: company._id, recruiter: owner.user._id });
    await auth('delete', `/api/v1/companies/me/team/${ownerMember.id}`, owner.token).expect(409);
  });

  it('returns only verified active companies publicly', async () => {
    const administrator = await admin(); const verifiedOwner = await register(); const pendingOwner = await register();
    await createVerifiedCompany(verifiedOwner, administrator, 'Verified Labs'); await approve(pendingOwner, administrator);
    await auth('post', '/api/v1/companies', pendingOwner.token).send({ name: 'Pending Labs' }).expect(201);
    const results = await request(app).get('/api/v1/companies?limit=10').expect(200);
    expect(results.body.data.pagination.total).toBe(1); expect(results.body.data.companies[0].name).toBe('Verified Labs');
  });
});

describe('job workflow and public discovery', () => {
  it('enforces approval, verification, protected fields, and admin review', async () => {
    const administrator = await admin(); const recruiter = await register();
    await auth('post', '/api/v1/jobs', recruiter.token).send(validJob()).expect(403);
    await approve(recruiter, administrator); const companyResponse = await auth('post', '/api/v1/companies', recruiter.token).send({ name: 'Job Labs' }).expect(201);
    const draft = await auth('post', '/api/v1/jobs', recruiter.token).send(validJob()).expect(201); const jobId = draft.body.data.job._id;
    await auth('patch', `/api/v1/jobs/manage/${jobId}`, recruiter.token).send({ status: 'published', isFeatured: true, viewsCount: 999 }).expect(400);
    await auth('patch', `/api/v1/jobs/manage/${jobId}/submit`, recruiter.token).expect(403);
    await auth('patch', `/api/v1/companies/admin/${companyResponse.body.data.company._id}/verify`, administrator.token).send({}).expect(200);
    const updatedRecruiter = await User.findById(recruiter.user._id);
    recruiter.token = generateAccessToken(updatedRecruiter.id, [updatedRecruiter.role], updatedRecruiter.tokenVersion);
    await auth('patch', `/api/v1/jobs/manage/${jobId}/publish`, recruiter.token).expect(403);
    await auth('patch', `/api/v1/jobs/manage/${jobId}/submit`, recruiter.token).expect(200);
    await auth('patch', `/api/v1/jobs/manage/${jobId}/submit`, recruiter.token).expect(409);
    const approved = await auth('patch', `/api/v1/jobs/admin/${jobId}/approve`, administrator.token).expect(200);
    expect(approved.body.data.job.status).toBe('published');
    await auth('patch', `/api/v1/jobs/manage/${jobId}/pause`, recruiter.token).expect(200);
    await auth('patch', `/api/v1/jobs/manage/${jobId}/resume`, recruiter.token).expect(200);
    await auth('patch', `/api/v1/jobs/manage/${jobId}/close`, recruiter.token).expect(200);
  });

  it('validates ranges, filters discovery, hides salary, and excludes unavailable jobs', async () => {
    const administrator = await admin(); const recruiter = await register(); const company = await createVerifiedCompany(recruiter, administrator, 'Discovery Labs');
    await auth('post', '/api/v1/jobs', recruiter.token).send({ ...validJob(), salary: { minimum: 120000, maximum: 80000, currency: 'USD', period: 'yearly' } }).expect(400);
    await auth('post', '/api/v1/jobs', recruiter.token).send({ ...validJob(), minimumExperience: 8, maximumExperience: 2 }).expect(400);
    await auth('post', '/api/v1/jobs', recruiter.token).send({ ...validJob(), applicationDeadline: new Date(Date.now() - 1000).toISOString() }).expect(400);
    const created = await auth('post', '/api/v1/jobs', recruiter.token).send(validJob()).expect(201); const id = created.body.data.job._id;
    await auth('patch', `/api/v1/jobs/manage/${id}/submit`, recruiter.token).expect(200); await auth('patch', `/api/v1/jobs/admin/${id}/approve`, administrator.token).expect(200);
    const results = await request(app).get('/api/v1/jobs?skills=Node.js&workMode=remote&limit=10').expect(200);
    expect(results.body.data.pagination.total).toBe(1); expect(results.body.data.jobs[0].salary).toEqual({ isVisible: false });
    await request(app).get('/api/v1/jobs?limit=51').expect(400);
    await auth('patch', `/api/v1/companies/admin/${company._id}/suspend`, administrator.token).send({ notes: 'Compliance hold' }).expect(200);
    expect((await request(app).get('/api/v1/jobs').expect(200)).body.data.pagination.total).toBe(0);
  });

  it('prevents cross-company changes and restricts admin actions', async () => {
    const administrator = await admin(); const first = await register(); const second = await register();
    const firstCompany = await createVerifiedCompany(first, administrator, 'First Labs');
    const secondCompany = await createVerifiedCompany(second, administrator, 'Second Labs');
    const created = await auth('post', '/api/v1/jobs', first.token).send(validJob()).expect(201); const id = created.body.data.job._id;
    await auth('patch', `/api/v1/jobs/manage/${id}`, second.token).send({ title: 'Stolen Job' }).expect(404);
    await auth('patch', `/api/v1/jobs/admin/${id}/approve`, first.token).expect(403);
    await auth('patch', `/api/v1/jobs/admin/${id}/feature`, first.token).expect(403);
  });
});
