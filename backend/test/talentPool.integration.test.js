import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Company } from '../src/models/Company.js';
import { Job } from '../src/models/Job.js';
import { RecruiterProfile } from '../src/models/RecruiterProfile.js';
import { CandidateProfile } from '../src/models/CandidateProfile.js';
import { CompanyTag } from '../src/models/CompanyTag.js';
import { TalentPoolMember } from '../src/models/TalentPoolMember.js';
import { generateAccessToken } from '../src/utils/jwt.js';

let replicaSet;
let sequence = 0;

const api = (method, path, token) => {
  const req = request(app)[method](path);
  if (token) {
    req.set('Authorization', `Bearer ${token}`);
  }
  return req;
};

const register = async (role = 'candidate') => {
  sequence += 1;
  const user = await User.create({
    fullName: `${role} User ${sequence}`,
    email: `talent.${sequence}@talvix.test`,
    password: 'Strong!Pass123',
    role,
  });
  return { user, token: generateAccessToken(user.id) };
};

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replicaSet.getUri());
  await User.init();
  await Company.init();
  await Job.init();
  await RecruiterProfile.init();
  await CandidateProfile.init();
  await CompanyTag.init();
  await TalentPoolMember.init();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Company.deleteMany({});
  await Job.deleteMany({});
  await RecruiterProfile.deleteMany({});
  await CandidateProfile.deleteMany({});
  await CompanyTag.deleteMany({});
  await TalentPoolMember.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

describe('Talent Pool API', () => {
  it('enforces recruiter-only access and handles unauthorized requests', async () => {
    const candidate = await register('candidate');
    await request(app).get('/api/v1/talent-pool').expect(401);
    await api('get', '/api/v1/talent-pool', candidate.token).expect(403);
  });

  it('allows recruiters to manage and query candidates in the talent pool', async () => {
    const recruiter = await register('recruiter');
    const company = await Company.create({
      name: 'Talent Labs',
      slug: 'talent-labs',
      owner: recruiter.user._id,
      verificationStatus: 'verified',
      teamMembers: [{ recruiter: recruiter.user._id, role: 'owner', permissions: ['jobs.update'], status: 'active' }]
    });

    await RecruiterProfile.create({
      user: recruiter.user._id,
      company: company._id,
      isApproved: true,
      permissions: ['jobs.update']
    });

    const candidate1 = await register('candidate');
    const profile1 = await CandidateProfile.create({
      user: candidate1.user._id,
      skills: [{ name: 'React', proficiency: 'advanced', yearsOfExperience: 3 }]
    });

    const candidate2 = await register('candidate');
    const profile2 = await CandidateProfile.create({
      user: candidate2.user._id,
      skills: [{ name: 'Node.js', proficiency: 'expert', yearsOfExperience: 5 }]
    });

    const tag = await CompanyTag.create({
      company: company._id,
      name: 'Premium',
      color: '#6366F1'
    });

    // 1. Add candidates to pool
    const add1 = await api('post', '/api/v1/talent-pool', recruiter.token)
      .send({ candidateId: candidate1.user._id.toString(), status: 'interested', tags: [tag._id.toString()] })
      .expect(201);
    expect(add1.body.data.member.status).toBe('interested');
    expect(add1.body.data.member.tags.length).toBe(1);

    await api('post', '/api/v1/talent-pool', recruiter.token)
      .send({ candidateId: candidate2.user._id.toString(), status: 'sourced' })
      .expect(201);

    // Duplicate check
    await api('post', '/api/v1/talent-pool', recruiter.token)
      .send({ candidateId: candidate1.user._id.toString() })
      .expect(409);

    // 2. Query pool
    const list = await api('get', '/api/v1/talent-pool', recruiter.token).expect(200);
    expect(list.body.data.items.length).toBe(2);

    // Search by skill React
    const searchSkills = await api('get', '/api/v1/talent-pool?skills=React', recruiter.token).expect(200);
    expect(searchSkills.body.data.items.length).toBe(1);
    expect(searchSkills.body.data.items[0].candidate.fullName).toContain('User');

    // Search by name text
    const searchName = await api('get', `/api/v1/talent-pool?search=${candidate2.user.fullName}`, recruiter.token).expect(200);
    expect(searchName.body.data.items.length).toBe(1);

    // 3. Mutate tag and status
    const update = await api('patch', `/api/v1/talent-pool/${add1.body.data.member._id}`, recruiter.token)
      .send({ status: 'contacted', tags: [] })
      .expect(200);
    expect(update.body.data.member.status).toBe('contacted');
    expect(update.body.data.member.tags.length).toBe(0);

    // 4. Add notes
    const note = await api('post', `/api/v1/talent-pool/${add1.body.data.member._id}/notes`, recruiter.token)
      .send({ content: 'Spoke on the phone, sounds promising.' })
      .expect(200);
    expect(note.body.data.member.notes.length).toBe(1);
    expect(note.body.data.member.notes[0].content).toBe('Spoke on the phone, sounds promising.');

    // 5. Remove candidate
    await api('delete', `/api/v1/talent-pool/${add1.body.data.member._id}`, recruiter.token).expect(200);
    const afterDelete = await api('get', '/api/v1/talent-pool', recruiter.token).expect(200);
    expect(afterDelete.body.data.items.length).toBe(1);
  });

  it('ranks candidates by Smart Job Match Sorting', async () => {
    const recruiter = await register('recruiter');
    const company = await Company.create({
      name: 'Sorting Corp',
      slug: 'sorting-corp',
      owner: recruiter.user._id,
      verificationStatus: 'verified',
      teamMembers: [{ recruiter: recruiter.user._id, role: 'owner', permissions: ['jobs.update'], status: 'active' }]
    });

    await RecruiterProfile.create({
      user: recruiter.user._id,
      company: company._id,
      isApproved: true,
      permissions: ['jobs.update']
    });

    const job = await Job.create({
      company: company._id,
      createdBy: recruiter.user._id,
      title: 'Senior Node Developer',
      slug: 'senior-node',
      description: 'Need Node expert',
      employmentType: 'full-time',
      workMode: 'remote',
      skills: [{ name: 'Node.js', required: true, minimumProficiency: 'expert', minimumYearsOfExperience: 5, weight: 100 }],
      openings: 1
    });

    // Candidate A: 5 years experience Node.js expert (Perfect Match)
    const candidateA = await register('candidate');
    const profileA = await CandidateProfile.create({
      user: candidateA.user._id,
      skills: [{ name: 'Node.js', proficiency: 'expert', yearsOfExperience: 5 }]
    });
    await TalentPoolMember.create({
      company: company._id,
      candidate: candidateA.user._id,
      candidateProfile: profileA._id,
      addedBy: recruiter.user._id
    });

    // Candidate B: 1 year experience Node.js beginner (Low Match)
    const candidateB = await register('candidate');
    const profileB = await CandidateProfile.create({
      user: candidateB.user._id,
      skills: [{ name: 'Node.js', proficiency: 'beginner', yearsOfExperience: 1 }]
    });
    await TalentPoolMember.create({
      company: company._id,
      candidate: candidateB.user._id,
      candidateProfile: profileB._id,
      addedBy: recruiter.user._id
    });

    const res = await api('get', `/api/v1/talent-pool?matchJobId=${job._id.toString()}`, recruiter.token).expect(200);
    expect(res.body.data.items.length).toBe(2);
    // Highest matching candidate should be first
    expect(res.body.data.items[0].candidate._id.toString()).toBe(candidateA.user._id.toString());
    expect(res.body.data.items[0].matchScore).toBeGreaterThan(res.body.data.items[1].matchScore);
  });
});
