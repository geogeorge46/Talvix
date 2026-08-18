import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Company } from '../backend/src/models/Company.js';

dotenv.config({ path: '../backend/.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/talvix';

try {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to DB');

  const createSafeRegex = (text) => {
    if (!text) return null;
    return new RegExp(text.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
  };

  const querySearch = 'talvix';
  const filter = { verificationStatus: 'verified', isActive: true };
  const conditions = [];
  if (querySearch) conditions.push({ $or: [{ name: createSafeRegex(querySearch) }, { description: createSafeRegex(querySearch) }] });
  if (conditions.length) filter.$and = conditions;

  console.log('Using filter:', JSON.stringify(filter, null, 2));

  const results = await Company.find(filter).lean();
  console.log('Found:', results.length, 'companies');
  results.forEach(r => console.log(`- ${r.name} (ID: ${r._id}, Status: ${r.verificationStatus}, Active: ${r.isActive})`));

  await mongoose.disconnect();
} catch (err) {
  console.error(err);
}
