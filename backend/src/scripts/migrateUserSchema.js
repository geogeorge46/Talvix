import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { User } from '../models/User.js';

async function migrate() {
  console.log('Connecting to database...');
  await connectDatabase();

  try {
    const users = await User.find({});
    console.log(`Found ${users.length} users to migrate.`);

    let migratedCount = 0;
    for (const user of users) {
      let modified = false;

      // Initialize roles from role
      if (!user.roles || user.roles.length === 0) {
        user.roles = [user.role || 'candidate'];
        modified = true;
      }

      // Initialize name from fullName
      if (!user.name && user.fullName) {
        user.name = user.fullName;
        modified = true;
      }

      // Initialize providers
      if (!user.providers || user.providers.length === 0) {
        user.providers = ['LOCAL'];
        modified = true;
      }

      // Initialize emailVerified from isVerified
      if (user.emailVerified === undefined && user.isVerified !== undefined) {
        user.emailVerified = user.isVerified;
        modified = true;
      }

      // Initialize blocked from isActive
      if (user.blocked === undefined && user.isActive !== undefined) {
        user.blocked = !user.isActive;
        modified = true;
      }

      // Initialize tokenVersion
      if (user.tokenVersion === undefined) {
        user.tokenVersion = 1;
        modified = true;
      }

      // Initialize recruiterVerificationStatus
      if (user.recruiterVerificationStatus === undefined) {
        user.recruiterVerificationStatus = user.role === 'recruiter' ? 'verified' : 'none';
        modified = true;
      }

      if (modified) {
        // Bypass normal pre-save password validation if no password exists
        await user.save({ validateModifiedOnly: true });
        migratedCount++;
      }
    }

    console.log(`Migration complete! Successfully migrated ${migratedCount} users.`);
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    console.log('Disconnecting database...');
    await disconnectDatabase();
  }
}

migrate();
