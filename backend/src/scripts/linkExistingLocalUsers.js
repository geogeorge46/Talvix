import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { User } from '../models/User.js';
import { FederatedIdentity } from '../models/FederatedIdentity.js';

async function run() {
  await connectDatabase();
  console.info('Connected to MongoDB.');

  const users = await User.find({}).select('+password');
  console.info(`Found ${users.length} users in database.`);

  let createdCount = 0;
  for (const user of users) {
    // If user has a password, we link a LOCAL identity so they can recover their password
    if (user.password || user.email === 'admin@talvix.local') {
      const exists = await FederatedIdentity.exists({
        userId: user._id,
        provider: 'LOCAL',
      });
      if (!exists) {
        await FederatedIdentity.create({
          userId: user._id,
          provider: 'LOCAL',
          providerId: user.email,
          email: user.email,
        });
        console.info(`Linked LOCAL credentials for: ${user.email}`);
        createdCount++;
      }
    }
  }

  console.info(`Successfully linked LOCAL credentials for ${createdCount} users.`);
  await disconnectDatabase();
}

run().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
