import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Company } from '../src/models/Company.js';
import { Organization } from '../src/models/Organization.js';
import { Role } from '../src/models/Role.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { Secret } from '../src/models/Secret.js';
import { SecurityIncident } from '../src/models/SecurityIncident.js';
import { TenantQuota } from '../src/models/TenantQuota.js';
import { BackgroundJob } from '../src/models/BackgroundJob.js';
import { RecruiterProfile } from '../src/models/RecruiterProfile.js';
import { CompanyMember } from '../src/models/CompanyMember.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { executeJob } from '../src/services/backgroundJobs.service.js';
import { enforceQuota } from '../src/services/admin.service.js';

let replicaSet;
let sequence = 0;

const createAccount = async (role = 'admin') => {
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
    role: 'admin',
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
    Organization.deleteMany({}),
    Role.deleteMany({}),
    AuditLog.deleteMany({}),
    Secret.deleteMany({}),
    SecurityIncident.deleteMany({}),
    TenantQuota.deleteMany({}),
    BackgroundJob.deleteMany({}),
    RecruiterProfile.deleteMany({}),
    CompanyMember.deleteMany({})
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

describe('Platform Governance, Identity, Security & Compliance Integration Tests', () => {

  describe('Organization Hierarchies Connect', () => {
    it('creates and updates organization structures successfully', async () => {
      const admin = await createAccount('admin');
      const company = await createMockCompany(admin.user._id);

      const res = await request(app)
        .post('/api/v1/admin/organizations')
        .set('Authorization', `Bearer ${admin.token}`)
        .set('X-Company-Id', String(company._id))
        .send({
          name: 'Talvix Global Org',
          branding: { primaryColor: '#E53E3E' },
          settings: { sessionTimeoutMs: 1800000 }
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.org.name).toBe('Talvix Global Org');

      // Verify audit trail is written
      const audit = await AuditLog.findOne({ company: company._id, action: 'create_org' });
      expect(audit).not.toBeNull();
    });

    it('enforces RBAC and blocks recruiters from platform controls', async () => {
      const recruiter = await createAccount('recruiter');
      await request(app)
        .post('/api/v1/admin/organizations')
        .set('Authorization', `Bearer ${recruiter.token}`)
        .send({ name: 'Hack Corp' })
        .expect(403);
    });
  });

  describe('Immutable Audit Trails & Secrets', () => {
    it('guarantees immutability of audit log documents', async () => {
      const admin = await createAccount('admin');
      const company = await createMockCompany(admin.user._id);

      const log = await AuditLog.create({
        actor: admin.user._id,
        company: company._id,
        action: 'test_action',
        resource: 'Test'
      });

      log.action = 'modified_action';
      await expect(log.save()).rejects.toThrow('Audit logs are immutable');
    });

    it('rotates secrets and masks outputs securely', async () => {
      const admin = await createAccount('admin');
      const company = await createMockCompany(admin.user._id);

      const res = await request(app)
        .post('/api/v1/admin/secrets/rotate')
        .set('Authorization', `Bearer ${admin.token}`)
        .set('X-Company-Id', String(company._id))
        .send({ key: 'RESEND_API_KEY', rotationPolicy: '30d' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.secret.encryptedValue).toBeDefined();
    });
  });

  describe('Quota Enforcements', () => {
    it('restricts resources based on quota caps', async () => {
      const admin = await createAccount('admin');
      const company = await createMockCompany(admin.user._id);

      // Update quotas
      await request(app)
        .put('/api/v1/admin/quotas')
        .set('Authorization', `Bearer ${admin.token}`)
        .set('X-Company-Id', String(company._id))
        .send({ users: 5 })
        .expect(200);

      // Verify quota check
      await expect(enforceQuota(company._id, 'users', 10)).rejects.toThrow('Tenant quota exceeded');
      const passed = await enforceQuota(company._id, 'users', 3);
      expect(passed).toBe(true);
    });
  });

  describe('Background Workers Scans', () => {
    it('runs background secret rotation workers successfully', async () => {
      const admin = await createAccount('admin');
      const company = await createMockCompany(admin.user._id);

      const job = await BackgroundJob.create({
        type: 'SECRET_ROTATION',
        payload: {
          companyId: company._id,
          key: 'CLOUDINARY_SECRET',
          rotationPolicy: 'manual'
        }
      });

      // Execute worker job
      await executeJob(job);

      const dbJob = await BackgroundJob.findById(job._id);
      expect(dbJob.status).toBe('completed');
    });
  });
});
