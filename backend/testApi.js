import mongoose from 'mongoose';
import dotenv from 'dotenv';
import request from 'supertest';
import { app } from '../backend/src/app.js';
import { Company } from '../backend/src/models/Company.js';

dotenv.config({ path: '../backend/.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/talvix';

try {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to DB');

  // Verify that Talvix Labs exists in database first
  const exists = await Company.findOne({ name: 'Talvix Labs' });
  console.log('Talvix Labs in DB:', !!exists);

  const res = await request(app)
    .get('/api/v1/companies?limit=10&search=talvix');

  console.log('HTTP Status:', res.status);
  console.log('Response Body:', JSON.stringify(res.body, null, 2));

  await mongoose.disconnect();
} catch (err) {
  console.error(err);
}
