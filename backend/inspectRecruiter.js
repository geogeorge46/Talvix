import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

import { User } from './src/models/User.js';
import { RecruiterProfile } from './src/models/RecruiterProfile.js';
import { Company } from './src/models/Company.js';
import { Job } from './src/models/Job.js';
import { CompanyMember } from './src/models/CompanyMember.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/talvix';

async function run() {
  console.log('Connecting to MongoDB at:', MONGODB_URI);
  await mongoose.connect(MONGODB_URI);
  console.log('Connected!');

  const email = 'recruiter24@gmail.com';
  const user = await User.findOne({ email });
  if (!user) {
    console.log(`User ${email} NOT found.`);
    await mongoose.disconnect();
    return;
  }

  console.log('\n=== User Details ===');
  console.log('ID:', user._id);
  console.log('Name:', user.fullName);
  console.log('Role:', user.role);

  const profile = await RecruiterProfile.findOne({ user: user._id });
  if (!profile) {
    console.log('\nRecruiterProfile NOT found for user.');
  } else {
    console.log('\n=== Recruiter Profile ===');
    console.log('Company ID:', profile.company);
    console.log('Is Approved:', profile.isApproved);
  }

  if (profile && profile.company) {
    const company = await Company.findById(profile.company);
    if (!company) {
      console.log('\nCompany NOT found in DB.');
    } else {
      console.log('\n=== Company Details ===');
      console.log('Company ID:', company._id);
      console.log('Name:', company.name);
      console.log('Is Active:', company.isActive);
    }

    const member = await CompanyMember.findOne({
      company: profile.company,
      recruiter: user._id,
    });
    if (!member) {
      console.log('\nCompanyMember record NOT found.');
    } else {
      console.log('\n=== Company Member Details ===');
      console.log('Role:', member.role);
      console.log('Status:', member.status);
      console.log('Permissions:', member.permissions);
    }

    const jobs = await Job.find({ company: profile.company });
    console.log('\n=== Jobs Found ===');
    console.log('Total jobs:', jobs.length);
    jobs.forEach((j, i) => {
      console.log(`${i+1}. Title: "${j.title}", ID: ${j._id}, Status: ${j.status}`);
    });
  }

  await mongoose.disconnect();
  console.log('\nDisconnected!');
}

run().catch(err => {
  console.error(err);
  mongoose.disconnect();
});
