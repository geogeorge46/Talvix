import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Company } from '../src/models/Company.js';
import { CompanyMember } from '../src/models/CompanyMember.js';
import { RecruiterProfile } from '../src/models/RecruiterProfile.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { generateAccessToken } from '../src/utils/jwt.js';

let replicaSet;

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replicaSet.getUri());
  await User.init();
  await Company.init();
  await CompanyMember.init();
  await RecruiterProfile.init();
  await AuditLog.init();
});

afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

describe('Recruiter Module Performance & Load Simulation', () => {
  it('measures response times and memory under concurrent dashboard requests', async () => {
    // 1. Seed a sample recruiter
    const recruiterUser = await User.create({
      fullName: 'Load Recruiter',
      email: 'load.rec@talvix.test',
      password: 'Password123!',
      role: 'recruiter'
    });
    
    const company = await Company.create({
      name: 'Load Test Corp',
      slug: 'load-test-corp',
      verificationStatus: 'verified',
      owner: recruiterUser._id
    });

    await CompanyMember.create({
      company: company._id,
      recruiter: recruiterUser._id,
      role: 'primary_admin',
      status: 'active'
    });

    await RecruiterProfile.create({
      user: recruiterUser._id,
      company: company._id,
      isCompanyOwner: true
    });

    // Seed some mock audit logs (e.g. 50 items)
    const logsData = Array.from({ length: 50 }).map((_, idx) => ({
      company: company._id,
      actor: recruiterUser._id,
      action: 'job.update',
      timestamp: new Date(Date.now() - idx * 60000)
    }));
    await AuditLog.create(logsData);

    const token = generateAccessToken(recruiterUser.id);

    console.log('--- STARTING CONCURRENT LOAD TEST ---');
    const startMemory = process.memoryUsage().heapUsed;
    const startTime = Date.now();

    // Simulate 200 concurrent dashboard requests
    const requestCount = 200;
    const promises = Array.from({ length: requestCount }).map(() =>
      request(app)
        .get('/api/v1/analytics/recruiter/dashboard')
        .set('Authorization', `Bearer ${token}`)
    );

    const responses = await Promise.all(promises);
    const duration = Date.now() - startTime;
    const endMemory = process.memoryUsage().heapUsed;

    const avgResponseTime = duration / requestCount;
    const memoryGrowthMb = (endMemory - startMemory) / 1024 / 1024;

    console.log(`Simulated ${requestCount} Concurrent Dashboard Queries`);
    console.log(`Total Duration: ${duration} ms`);
    console.log(`Average Response Time: ${avgResponseTime.toFixed(2)} ms / request`);
    console.log(`Memory Heap Used Growth: ${memoryGrowthMb.toFixed(2)} MB`);

    // Verify all returned 200 OK
    for (const res of responses) {
      expect(res.status).toBe(200);
    }

    // Expect average query latency to be very low (thanks to our in-memory analyticsCache!)
    expect(avgResponseTime).toBeLessThan(100); // 100ms latency threshold
    console.log('--- CONCURRENT LOAD TEST COMPLETED ---');
  });
});
