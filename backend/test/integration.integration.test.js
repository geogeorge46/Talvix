import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Company } from '../src/models/Company.js';
import { HRISIntegration } from '../src/models/HRISIntegration.js';
import { WebhookSubscription } from '../src/models/WebhookSubscription.js';
import { APIKey } from '../src/models/APIKey.js';
import { BackgroundJob } from '../src/models/BackgroundJob.js';
import { RecruiterProfile } from '../src/models/RecruiterProfile.js';
import { CompanyMember } from '../src/models/CompanyMember.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { executeJob } from '../src/services/backgroundJobs.service.js';

let replicaSet;
let sequence = 0;

const createAccount = async (role = 'recruiter') => {
  sequence += 1;
  const user = await User.create({
    fullName: `${role} AI User ${sequence}`,
    email: `ai.test.user.${sequence}@talvix.test`,
    password: 'Password123!',
    role
  });
  return { user, token: generateAccessToken(user.id) };
};

const createMockCompany = async (ownerId) => {
  sequence += 1;
  const company = await Company.create({
    name: `Company ${sequence}`,
    slug: `company-${sequence}`,
    owner: ownerId,
    isActive: true
  });

  await RecruiterProfile.create({
    user: ownerId,
    company: company._id,
    isApproved: true
  });

  await CompanyMember.create({
    company: company._id,
    recruiter: ownerId,
    role: 'recruiter',
    permissions: ['jobs.create', 'jobs.update', 'jobs.publish', 'jobs.delete'],
    status: 'active'
  });

  return company;
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
    HRISIntegration.deleteMany({}),
    WebhookSubscription.deleteMany({}),
    APIKey.deleteMany({}),
    BackgroundJob.deleteMany({}),
    RecruiterProfile.deleteMany({}),
    CompanyMember.deleteMany({})
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

describe('HRIS, Webhooks & Enterprise Identity Integration Tests', () => {

  describe('HRIS Integrations Connect & Sync', () => {
    it('configures connection credentials and syncs BambooHR records successfully', async () => {
      const recruiter = await createAccount('recruiter');
      const company = await createMockCompany(recruiter.user._id);

      // Connect HRIS provider
      const connRes = await request(app)
        .post('/api/v1/integrations/hris')
        .set('Authorization', `Bearer ${recruiter.token}`)
        .set('X-Company-Id', String(company._id))
        .send({
          provider: 'bamboohr',
          credentials: { apiKey: 'secret-key-1', subdomain: 'talvix' }
        })
        .expect(201);

      expect(connRes.body.success).toBe(true);
      expect(connRes.body.data.connection.status).toBe('connected');

      // Trigger sync
      const syncRes = await request(app)
        .post('/api/v1/integrations/hris/bamboohr/sync')
        .set('Authorization', `Bearer ${recruiter.token}`)
        .set('X-Company-Id', String(company._id))
        .expect(200);

      expect(syncRes.body.success).toBe(true);
      expect(syncRes.body.data.result.syncedRecordsCount).toBe(42);
    });

    it('enforces RBAC and blocks candidate connectors setup', async () => {
      const candidate = await createAccount('candidate');
      await request(app)
        .post('/api/v1/integrations/hris')
        .set('Authorization', `Bearer ${candidate.token}`)
        .send({ provider: 'bamboohr' })
        .expect(403);
    });
  });

  describe('Developer API Keys Access', () => {
    it('generates secure developer API keys successfully', async () => {
      const recruiter = await createAccount('recruiter');
      const company = await createMockCompany(recruiter.user._id);

      const res = await request(app)
        .post('/api/v1/integrations/keys')
        .set('Authorization', `Bearer ${recruiter.token}`)
        .set('X-Company-Id', String(company._id))
        .send({ name: 'Staging API Access Token' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.apiKey.key).toContain('tlvx_');
    });
  });

  describe('Webhooks Dispatcher', () => {
    it('registers public webhook target URLs successfully', async () => {
      const recruiter = await createAccount('recruiter');
      const company = await createMockCompany(recruiter.user._id);

      const res = await request(app)
        .post('/api/v1/integrations/webhooks')
        .set('Authorization', `Bearer ${recruiter.token}`)
        .set('X-Company-Id', String(company._id))
        .send({
          targetUrl: 'https://external-hris.com/webhook',
          events: ['candidate.matched', 'offer.accepted']
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.subscription.secret).toContain('whsec_');
    });
  });

  describe('Background Workers Scans', () => {
    it('runs background HRIS sync workers successfully', async () => {
      const recruiter = await createAccount('recruiter');
      const company = await createMockCompany(recruiter.user._id);

      // Connect first
      await HRISIntegration.create({
        company: company._id,
        provider: 'bamboohr',
        status: 'disconnected',
        createdBy: recruiter.user._id
      });

      const job = await BackgroundJob.create({
        type: 'HRIS_SYNC',
        payload: {
          companyId: company._id,
          provider: 'bamboohr'
        }
      });

      // Execute worker job
      await executeJob(job);

      const dbJob = await BackgroundJob.findById(job._id);
      expect(dbJob.status).toBe('completed');
    });
  });
});
