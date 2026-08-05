import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Company } from '../src/models/Company.js';
import { ResumeProfile } from '../src/models/ResumeProfile.js';
import { ResumeVersion } from '../src/models/ResumeVersion.js';
import { ResumeEmbedding } from '../src/models/ResumeEmbedding.js';
import { Document } from '../src/models/Document.js';
import { BackgroundJob } from '../src/models/BackgroundJob.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { executeJob } from '../src/services/backgroundJobs.service.js';

let replicaSet;
let sequence = 0;

const createAccount = async (role = 'candidate') => {
  sequence += 1;
  const user = await User.create({
    fullName: `${role} AI User ${sequence}`,
    email: `ai.resume.user.${sequence}@talvix.test`,
    password: 'Password123!',
    role
  });
  return { user, token: generateAccessToken(user.id) };
};

const createMockCompany = async (ownerId) => {
  sequence += 1;
  return await Company.create({
    name: `Company ${sequence}`,
    slug: `company-${sequence}`,
    owner: ownerId
  });
};

const createMockDocument = async (userId, fileName = 'resume.pdf') => {
  return await Document.create({
    owner: userId,
    ownerRole: 'candidate',
    uploadedBy: userId,
    category: 'resume',
    purpose: 'Resume Upload',
    entityType: 'candidate-profile',
    entityId: new mongoose.Types.ObjectId(),
    originalFileName: fileName,
    displayName: fileName,
    mimeType: 'application/pdf',
    mediaType: 'document',
    sizeBytes: 100,
    checksum: `checksum_${userId}_${Math.random()}`,
    storage: {
      provider: 'memory',
      publicId: `pub_${userId}_${Math.random()}`,
      resourceType: 'raw'
    },
    status: 'active',
    isCurrent: true
  });
};

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replicaSet.getUri());
  await User.init();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Company.deleteMany({}),
    ResumeProfile.deleteMany({}),
    ResumeVersion.deleteMany({}),
    ResumeEmbedding.deleteMany({}),
    Document.deleteMany({}),
    BackgroundJob.deleteMany({})
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

describe('Resume Intelligence Integration Tests', () => {

  describe('Resume Upload & Parsing Pipeline', () => {
    it('allows candidate to upload resume and triggers background parsing successfully', async () => {
      const candidate = await createAccount('candidate');
      
      const res = await request(app)
        .post('/api/v1/resumes/upload')
        .set('Authorization', `Bearer ${candidate.token}`)
        .attach('file', Buffer.from('Mock PDF text content Jane Doe React Developer'), 'resume.pdf')
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.documentId).toBeDefined();
      expect(res.body.data.jobId).toBeDefined();

      // Check that a background job was registered
      const job = await BackgroundJob.findById(res.body.data.jobId);
      expect(job.type).toBe('RESUME_PARSE');
      expect(job.status).toBe('pending');

      // Execute background job
      await executeJob(job);

      // Verify that parsed profile was created successfully
      const profile = await ResumeProfile.findOne({ candidate: candidate.user._id });
      expect(profile).toBeDefined();
      expect(profile.personalInfo.fullName).toBe('Jane Doe');
      expect(profile.skills.technical).toContain('React');
      expect(profile.currentVersion).toBe(1);

      // Verify that historic version was saved
      const hist = await ResumeVersion.findOne({ resumeProfile: profile._id, version: 1 });
      expect(hist).toBeDefined();
    });

    it('enforces RBAC and blocks recruiters from uploading resumes', async () => {
      const recruiter = await createAccount('recruiter');

      await request(app)
        .post('/api/v1/resumes/upload')
        .set('Authorization', `Bearer ${recruiter.token}`)
        .attach('file', Buffer.from('PDF Content'), 'resume.pdf')
        .expect(403);
    });
  });

  describe('Version Timelines & Restorations', () => {
    it('supports version comparisons, restorations, and side-by-side matches', async () => {
      const candidate = await createAccount('candidate');
      
      // Simulate multi-version uploads
      const doc1 = await createMockDocument(candidate.user._id, 'v1.pdf');
      const doc2 = await createMockDocument(candidate.user._id, 'v2.pdf');

      const profile = await ResumeProfile.create({
        candidate: candidate.user._id,
        document: doc2._id,
        personalInfo: { fullName: 'Jane Doe V2', email: 'jane@example.com' },
        skills: { technical: ['Vue', 'Express'] },
        currentVersion: 2
      });

      await ResumeVersion.create([
        {
          resumeProfile: profile._id,
          version: 1,
          parsedData: { personalInfo: { fullName: 'Jane Doe V1', email: 'jane@example.com' }, skills: { technical: ['React'] } },
          document: doc1._id,
          createdBy: candidate.user._id
        },
        {
          resumeProfile: profile._id,
          version: 2,
          parsedData: { personalInfo: { fullName: 'Jane Doe V2', email: 'jane@example.com' }, skills: { technical: ['Vue', 'Express'] } },
          document: doc2._id,
          createdBy: candidate.user._id
        }
      ]);

      // Verify versions can be retrieved
      let res = await request(app)
        .get('/api/v1/resumes/versions')
        .set('Authorization', `Bearer ${candidate.token}`)
        .expect(200);

      expect(res.body.data.versions.length).toBe(2);

      // Compare versions
      res = await request(app)
        .get('/api/v1/resumes/compare?v1=1&v2=2')
        .set('Authorization', `Bearer ${candidate.token}`)
        .expect(200);
      expect(res.body.data.version1.personalInfo.fullName).toBe('Jane Doe V1');
      expect(res.body.data.version2.personalInfo.fullName).toBe('Jane Doe V2');

      // Restore to version 1
      res = await request(app)
        .post('/api/v1/resumes/versions/1/restore')
        .set('Authorization', `Bearer ${candidate.token}`)
        .expect(200);

      expect(res.body.data.profile.personalInfo.fullName).toBe('Jane Doe V1');
      expect(res.body.data.profile.skills.technical).toContain('React');
    });
  });

  describe('Multi-Tenant Semantic Searching', () => {
    it('allows recruiters to search candidate pool using both text and vector distances', async () => {
      const recruiter = await createAccount('recruiter');
      await createMockCompany(recruiter.user._id);

      const candidate = await createAccount('candidate');

      // Setup profile
      const doc = await createMockDocument(candidate.user._id, 'res.pdf');
      const profile = await ResumeProfile.create({
        candidate: candidate.user._id,
        document: doc._id,
        personalInfo: { fullName: 'Bob Dev', city: 'San Jose', country: 'USA' },
        skills: { technical: ['TypeScript', 'Node.js'] },
        searchTokens: ['Bob', 'TypeScript', 'Node.js']
      });

      // Create embedding
      await ResumeEmbedding.create({
        resumeProfile: profile._id,
        version: 1,
        vector: Array.from({ length: 768 }, () => 0.1)
      });

      // Recruiter does query search
      const res = await request(app)
        .get('/api/v1/resumes/search?query=TypeScript')
        .set('Authorization', `Bearer ${recruiter.token}`)
        .expect(200);

      expect(res.body.data.results.length).toBeGreaterThan(0);
      expect(res.body.data.results[0].personalInfo.fullName).toBe('Bob Dev');
    });
  });
});
