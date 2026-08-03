import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Company } from '../src/models/Company.js';
import { CompanyMember } from '../src/models/CompanyMember.js';
import { RecruiterProfile } from '../src/models/RecruiterProfile.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { Notification } from '../src/models/Notification.js';
import { SavedAnalyticsView } from '../src/models/SavedAnalyticsView.js';
import { RecruiterDashboardConfig } from '../src/models/RecruiterDashboardConfig.js';
import { generateAccessToken } from '../src/utils/jwt.js';

let replicaSet;
let sequence = 0;

const createAccount = async (role = 'recruiter', companyId = null, memberRole = 'recruiter') => {
  sequence += 1;
  const user = await User.create({
    fullName: `Enhanced Recruiter ${sequence}`,
    email: `enhanced.rec.${sequence}@talvix.test`,
    password: 'Password123!',
    role: role
  });

  let company = null;
  let member = null;

  if (companyId) {
    company = await Company.findById(companyId);
    member = await CompanyMember.create({
      company: companyId,
      recruiter: user._id,
      role: memberRole,
      status: 'active'
    });
    await RecruiterProfile.create({
      user: user._id,
      company: companyId,
      isCompanyOwner: memberRole === 'primary_admin'
    });
  } else if (role === 'recruiter') {
    company = await Company.create({
      name: `Enhanced Company ${sequence}`,
      slug: `enhanced-company-${sequence}`,
      verificationStatus: 'verified',
      owner: user._id
    });
    member = await CompanyMember.create({
      company: company._id,
      recruiter: user._id,
      role: memberRole,
      status: 'active'
    });
    await RecruiterProfile.create({
      user: user._id,
      company: company._id,
      isCompanyOwner: true
    });
  }

  return {
    user,
    company,
    member,
    token: generateAccessToken(user.id)
  };
};

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replicaSet.getUri());
  await User.init();
  await Company.init();
  await CompanyMember.init();
  await RecruiterProfile.init();
  await AuditLog.init();
  await Notification.init();
  await SavedAnalyticsView.init();
  await RecruiterDashboardConfig.init();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Company.deleteMany({}),
    CompanyMember.deleteMany({}),
    RecruiterProfile.deleteMany({}),
    AuditLog.deleteMany({}),
    Notification.deleteMany({}),
    SavedAnalyticsView.deleteMany({}),
    RecruiterDashboardConfig.deleteMany({})
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

describe('Recruiter Module Enhancements', () => {
  it('allows recruiters to get, update, and reset dashboard widget layouts', async () => {
    const { token } = await createAccount('recruiter');

    // 1. Fetch default widgets
    const resGet = await request(app)
      .get('/api/v1/dashboard/widgets')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(resGet.body.success).toBe(true);
    expect(resGet.body.data.widgets.length).toBe(10);
    expect(resGet.body.data.widgets[0].id).toBe('activeJobs');

    // 2. Update widget layouts (reorder and toggle visibility)
    const customLayout = [
      { id: 'analytics', visible: true, order: 0 },
      { id: 'activeJobs', visible: false, order: 1 }
    ];

    const resPatch = await request(app)
      .patch('/api/v1/dashboard/widgets')
      .set('Authorization', `Bearer ${token}`)
      .send({ widgets: customLayout })
      .expect(200);

    expect(resPatch.body.success).toBe(true);
    expect(resPatch.body.data.widgets[0].id).toBe('analytics');
    expect(resPatch.body.data.widgets[1].visible).toBe(false);

    // 3. Reset widgets
    const resReset = await request(app)
      .patch('/api/v1/dashboard/widgets')
      .set('Authorization', `Bearer ${token}`)
      .send({ reset: true })
      .expect(200);

    expect(resReset.body.success).toBe(true);
    expect(resReset.body.data.widgets[0].id).toBe('activeJobs');
    expect(resReset.body.data.widgets[0].visible).toBe(true);
  });

  it('allows managing saved analytics views', async () => {
    const { token } = await createAccount('recruiter');

    // 1. Save a view preset
    const viewBody = {
      name: 'Engineering Hiring',
      filters: { department: 'engineering', range: '30' },
      isDefault: true
    };

    const resSave = await request(app)
      .post('/api/v1/analytics/saved-views')
      .set('Authorization', `Bearer ${token}`)
      .send(viewBody)
      .expect(201);

    expect(resSave.body.success).toBe(true);
    expect(resSave.body.data.view.name).toBe('Engineering Hiring');
    expect(resSave.body.data.view.isDefault).toBe(true);

    // 2. List saved views
    const resList = await request(app)
      .get('/api/v1/analytics/saved-views')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(resList.body.success).toBe(true);
    expect(resList.body.data.views.length).toBe(1);

    // 3. Delete saved view
    const viewId = resSave.body.data.view._id;
    await request(app)
      .delete(`/api/v1/analytics/saved-views/${viewId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const resListEmpty = await request(app)
      .get('/api/v1/analytics/saved-views')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(resListEmpty.body.data.views.length).toBe(0);
  });

  it('translates priority levels and serializes actionable buttons dynamically', async () => {
    const { user, company, token } = await createAccount('recruiter');

    // Create a notification record in database
    const nRecord = await Notification.create({
      recipient: user._id,
      recipientRole: 'recruiter',
      company: company._id,
      type: 'application-submitted',
      category: 'application',
      priority: 'urgent', // urgent maps to critical
      title: 'New Application',
      message: 'Candidate applied for Node.js developer role',
      data: { applicationId: '60c72b2f9b1d8e1f5c8db999' },
      source: 'application'
    });

    const resList = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(resList.body.success).toBe(true);
    const serialized = resList.body.data.notifications[0];
    expect(serialized.priority).toBe('critical'); // urgent maps to critical
    expect(serialized.actions.length).toBe(3);
    expect(serialized.actions[0].label).toBe('View Candidate');
    expect(serialized.actions[2].label).toBe('Reject Candidate');
  });

  it('sets up realtime event stream connections with query token authorization', async () => {
    const { token } = await createAccount('recruiter');

    // Establish realtime connection and abort it shortly after verification
    const req = request(app).get(`/api/v1/realtime/stream?token=${token}`);

    await new Promise((resolve, reject) => {
      req
        .expect('Content-Type', /event-stream/)
        .expect(200)
        .end((err, res) => {
          if (err) return reject(err);
          resolve(res);
        });

      // Synchronously check state and close the request connection socket
      setTimeout(() => {
        req.abort();
        resolve(true);
      }, 200);
    });
  });

  it('groups repeated activities in activity timeline logs', async () => {
    const { user, company, token } = await createAccount('recruiter');

    // Seed repeated log events within a 1-minute window
    const now = new Date();
    await AuditLog.create([
      {
        company: company._id,
        actor: user._id,
        action: 'job.update',
        timestamp: new Date(now.getTime() - 20000)
      },
      {
        company: company._id,
        actor: user._id,
        action: 'job.update',
        timestamp: now
      }
    ]);

    const resTimeline = await request(app)
      .get('/api/v1/analytics/recruiter/activity-timeline')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(resTimeline.body.success).toBe(true);
    expect(resTimeline.body.data.items.length).toBe(1); // Grouped into 1 item
    expect(resTimeline.body.data.items[0].count).toBe(2); // with occurrence count of 2
  });
});
