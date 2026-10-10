import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Company } from '../src/models/Company.js';
import { CompanyMember } from '../src/models/CompanyMember.js';
import { RecruiterProfile } from '../src/models/RecruiterProfile.js';
import { Job } from '../src/models/Job.js';
import { AIProvider } from '../src/models/AIProvider.js';
import { AIConfiguration } from '../src/models/AIConfiguration.js';
import { AIPrompt } from '../src/models/AIPrompt.js';
import { AIUsageLog } from '../src/models/AIUsageLog.js';
import { AICache } from '../src/models/AICache.js';
import { generateAccessToken } from '../src/utils/jwt.js';

let replicaSet;
let sequence = 0;
let originalOpenRouterKey;

const createAccount = async (role = 'recruiter', permissions = ['jobs.create', 'jobs.update', 'jobs.publish']) => {
  sequence += 1;
  const user = await User.create({
    fullName: `Test Recruiter ${sequence}`,
    email: `recruiter.${sequence}@talvix.test`,
    password: 'Password123!',
    role
  });

  let company = null;
  let member = null;
  let profile = null;

  if (role === 'recruiter') {
    company = await Company.create({
      name: `Talvix Technologies ${sequence}`,
      slug: `talvix-tech-${sequence}`,
      owner: user._id,
      industry: 'Software Engineering',
      description: 'Talvix Technologies builds high-throughput AI talent platform engines.',
      headquarters: { city: 'Bengaluru', state: 'Karnataka', country: 'India' },
      benefits: ['Flexible Working Hours', 'Health & Dental Care', 'Learning Stipend'],
      technologies: ['TypeScript', 'React', 'Node.js', 'MongoDB'],
      verificationStatus: 'verified',
      isActive: true
    });

    member = await CompanyMember.create({
      recruiter: user._id,
      company: company._id,
      role: 'admin',
      permissions,
      status: 'active',
      joinedAt: new Date()
    });

    profile = await RecruiterProfile.create({
      user: user._id,
      company: company._id,
      isApproved: true,
      isCompanyOwner: true,
      permissions
    });
  }

  const token = generateAccessToken(user.id);
  return { user, company, member, profile, token };
};

beforeAll(async () => {
  originalOpenRouterKey = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replicaSet.getUri());
  await User.init();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Company.deleteMany({}),
    CompanyMember.deleteMany({}),
    RecruiterProfile.deleteMany({}),
    Job.deleteMany({}),
    AIProvider.deleteMany({}),
    AIConfiguration.deleteMany({}),
    AIPrompt.deleteMany({}),
    AIUsageLog.deleteMany({}),
    AICache.deleteMany({})
  ]);

  await AIProvider.create({
    name: 'gemini',
    displayName: 'Google Gemini',
    isActive: true,
    costPerInputToken: 0.000002,
    costPerOutputToken: 0.000006,
    supportedModels: ['gemini-2.5-flash']
  });
});

afterAll(async () => {
  if (originalOpenRouterKey !== undefined) {
    process.env.OPENROUTER_API_KEY = originalOpenRouterKey;
  }
  await mongoose.disconnect();
  await replicaSet.stop();
});

describe('Talvix Stage 2 — End-to-End AI Job Creation Workflow', () => {

  describe('Complete Happy Path Recruiter Workflow', () => {
    it('executes full workflow: AI description generation -> custom recruiter edits -> job draft creation -> persistence verification', async () => {
      // 1. Log in as an authorized recruiter associated with an active verified company
      const { user, company, token } = await createAccount('recruiter');

      // 2 & 3. Submit AI Description Generation request with job parameters
      const aiResponse = await request(app)
        .post('/api/v1/jobs/ai/generate-description')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Lead Full Stack Engineer',
          department: 'Core Infrastructure',
          employmentType: 'full-time',
          workMode: 'hybrid',
          minimumExperience: 6,
          maximumExperience: 10,
          skills: ['TypeScript', 'Node.js', 'React', 'MongoDB'],
          location: 'Bengaluru, India'
        })
        .expect(200);

      expect(aiResponse.body.success).toBe(true);
      expect(aiResponse.body.data.description).toBeTypeOf('string');
      expect(aiResponse.body.data.description).toContain('Lead Full Stack Engineer');

      const rawAiDescription = aiResponse.body.data.description;

      // 4. Verify AI generation does NOT automatically create a job document in DB
      const jobCountBeforeSave = await Job.countDocuments({ company: company._id });
      expect(jobCountBeforeSave).toBe(0);

      // 5. Edit generated description with recruiter modifications
      const customEditedDescription = `${rawAiDescription}\n\n### Custom Recruiter Note\nCandidates must have experience leading high-scale distributed systems migrations.`;

      // 6. Save job through existing job creation endpoint (POST /api/v1/jobs)
      const saveResponse = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Lead Full Stack Engineer',
          description: customEditedDescription,
          department: 'Core Infrastructure',
          employmentType: 'full-time',
          workMode: 'hybrid',
          minimumExperience: 6,
          maximumExperience: 10,
          openings: 2,
          skills: [
            { name: 'TypeScript', required: true, minimumProficiency: 'expert', weight: 80 },
            { name: 'Node.js', required: true, minimumProficiency: 'advanced', weight: 90 },
            { name: 'React', required: false, minimumProficiency: 'intermediate', weight: 60 }
          ],
          location: { city: 'Bengaluru', state: 'Karnataka', country: 'India' }
        })
        .expect(201);

      expect(saveResponse.body.success).toBe(true);
      expect(saveResponse.body.data.job).toBeDefined();

      const createdJobId = saveResponse.body.data.job._id;

      // 7. Verify saved job in database has correct company, description, skills, experience, and status 'draft'
      const savedJobDoc = await Job.findById(createdJobId);
      expect(savedJobDoc).toBeDefined();
      expect(savedJobDoc.company.toString()).toBe(company._id.toString());
      expect(savedJobDoc.createdBy.toString()).toBe(user._id.toString());
      expect(savedJobDoc.title).toBe('Lead Full Stack Engineer');
      expect(savedJobDoc.description).toBe(customEditedDescription);
      expect(savedJobDoc.description).toContain('Candidates must have experience leading high-scale distributed systems migrations');
      expect(savedJobDoc.minimumExperience).toBe(6);
      expect(savedJobDoc.maximumExperience).toBe(10);
      expect(savedJobDoc.status).toBe('draft'); // Crucial: Generated draft is NOT auto-published!

      // 8. Reload / query managed job details endpoint (GET /api/v1/jobs/manage/:jobId)
      const fetchResponse = await request(app)
        .get(`/api/v1/jobs/manage/${createdJobId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(fetchResponse.body.success).toBe(true);
      expect(fetchResponse.body.data.job._id).toBe(createdJobId);
      expect(fetchResponse.body.data.job.title).toBe('Lead Full Stack Engineer');
      expect(fetchResponse.body.data.job.description).toContain('Custom Recruiter Note');
    });
  });

  describe('Error Handling & Boundary Safeguards', () => {
    it('separates AI generation and job creation (AI generation does not auto-save or publish)', async () => {
      const { token, company } = await createAccount('recruiter');

      await request(app)
        .post('/api/v1/jobs/ai/generate-description')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Staff QA Engineer' })
        .expect(200);

      const jobCount = await Job.countDocuments({ company: company._id });
      expect(jobCount).toBe(0);
    });

    it('rejects unauthorized users (candidate) from generating descriptions or saving jobs', async () => {
      const candidate = await createAccount('candidate');

      // Description generation forbidden
      await request(app)
        .post('/api/v1/jobs/ai/generate-description')
        .set('Authorization', `Bearer ${candidate.token}`)
        .send({ title: 'Software Engineer' })
        .expect(403);

      // Job creation forbidden
      await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${candidate.token}`)
        .send({ title: 'Software Engineer', description: 'Desc' })
        .expect(403);
    });

    it('rejects invalid inputs on job creation with HTTP 400', async () => {
      const { token } = await createAccount('recruiter');

      // Invalid experience range
      await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Senior DevOps',
          description: 'Valid description text',
          employmentType: 'full-time',
          workMode: 'remote',
          minimumExperience: 8,
          maximumExperience: 3
        })
        .expect(400);
    });

    it('prevents multi-tenant cache leakage across companies', async () => {
      const tenantA = await createAccount('recruiter');
      const tenantB = await createAccount('recruiter');

      await AIConfiguration.create({
        company: null,
        primaryProvider: 'gemini',
        cachingEnabled: true,
        cacheTtlSeconds: 300
      });

      const payload = { title: 'Security Architect', minimumExperience: 7 };

      // Tenant A calls AI description generation
      await request(app)
        .post('/api/v1/jobs/ai/generate-description')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(payload)
        .expect(200);

      // Tenant B calls with same payload
      await request(app)
        .post('/api/v1/jobs/ai/generate-description')
        .set('Authorization', `Bearer ${tenantB.token}`)
        .send(payload)
        .expect(200);

      // Verify Tenant B's request did not hit Tenant A's cache
      const logB = await AIUsageLog.findOne({ company: tenantB.company._id }).sort({ createdAt: -1 });
      expect(logB).toBeDefined();
      expect(logB.requestPayload.cacheHit).toBeUndefined();
    });
  });
});
