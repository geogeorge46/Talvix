import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Application } from '../src/models/Application.js';
import { Company } from '../src/models/Company.js';
import { Job } from '../src/models/Job.js';
import { User } from '../src/models/User.js';
import { seedDemo } from '../src/scripts/seedDemo.js';
import { verifyPassword } from '../src/utils/password.js';

let replicaSet;

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replicaSet.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

describe('development demo seed', () => {
  it('creates the local fixture once and reuses it without duplication', async () => {
    const first = await seedDemo();
    const second = await seedDemo();

    expect(first.users.created).toBe(8);
    expect(second.users).toMatchObject({ created: 0, reused: 8, total: 8 });
    expect(await User.countDocuments({ email: /@talvix\.local$/ })).toBe(8);
    expect(await Company.countDocuments({ slug: { $in: ['talvix-labs', 'startup-labs'] } })).toBe(2);
    expect(await Job.countDocuments({ company: (await Company.findOne({ slug: 'talvix-labs' })).id })).toBe(3);
    expect(await Application.countDocuments({ applicationNumber: /^TLVX-DEMO-/ })).toBe(5);

    const admin = await User.findOne({ email: 'admin@talvix.local' }).select('+password');
    expect(admin.role).toBe('admin');
    expect(await verifyPassword('Admin@12345', admin.password)).toBe(true);
  });
});
