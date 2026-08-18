import mongoose from 'mongoose';
import dotenv from 'dotenv';
import request from 'supertest';
import { app } from '../backend/src/app.js';
import { User } from '../backend/src/models/User.js';

dotenv.config({ path: '../backend/.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/talvix';

try {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to DB');

  // Find admin user to authenticate
  const admin = await User.findOne({ role: 'admin' });
  if (!admin) {
    console.error('No admin found!');
    process.exit(1);
  }

  // Generate token
  // Let's use jwt helper if available, or just mock/create a token or find a real admin login
  // Wait, in dualVerification.test.js, how is the admin token generated?
  // It uses generateAccessToken(admin._id);
  const { generateAccessToken } = await import('../backend/src/utils/jwt.js');
  const adminToken = generateAccessToken(admin._id);

  const res = await request(app)
    .get('/api/v1/recruiters/admin/pending?limit=10&page=1')
    .set('Authorization', `Bearer ${adminToken}`);

  console.log('HTTP Status:', res.status);
  console.log('Recruiters count:', res.body.data?.recruiters?.length);
  console.log('Recruiters:', JSON.stringify(res.body.data, null, 2));

  await mongoose.disconnect();
} catch (err) {
  console.error(err);
}
