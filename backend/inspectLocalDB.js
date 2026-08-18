import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '../backend/.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/talvix';

console.log('Connecting to:', MONGODB_URI);

try {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected successfully!');

  // Define simple schemas
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const Company = mongoose.model('Company', new mongoose.Schema({}, { strict: false }));
  const RecruiterProfile = mongoose.model('RecruiterProfile', new mongoose.Schema({}, { strict: false }));

  const admins = await User.find({ role: 'admin' });
  console.log('\n--- Admins ---');
  admins.forEach(a => console.log(`ID: ${a._id}, Email: ${a.email}, Name: ${a.fullName}`));

  const pendingRecruiters = await User.find({ role: 'recruiter', recruiterVerificationStatus: 'pending' });
  console.log('\n--- Pending Recruiters ---');
  pendingRecruiters.forEach(r => console.log(`ID: ${r._id}, Email: ${r.email}, Name: ${r.fullName}, Verification Status: ${r.recruiterVerificationStatus}`));

  const pendingProfiles = await RecruiterProfile.find({ isApproved: false });
  console.log('\n--- Pending Recruiter Profiles ---');
  pendingProfiles.forEach(p => console.log(`Profile ID: ${p._id}, User: ${p.user}, Company ID: ${p.company}, designation: ${p.designation}`));

  const allCompanies = await Company.find({});
  console.log('\n--- All Companies ---');
  allCompanies.forEach(c => console.log(`ID: ${c._id}, Name: ${c.name}, Status: ${c.verificationStatus}`));

  await mongoose.disconnect();
} catch (err) {
  console.error('Error:', err);
}
