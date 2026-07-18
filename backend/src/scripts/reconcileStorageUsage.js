import { pathToFileURL } from 'node:url';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { expireStaleReservations, recalculateAllStorageUsage } from '../services/storageReservation.service.js';

const run = async () => { try { await connectDatabase(); const expired = await expireStaleReservations(); const usages = await recalculateAllStorageUsage(); console.info(`Storage reconciliation completed: ${expired} reservations expired, ${usages.length} user counters recalculated.`); } finally { await disconnectDatabase(); } };
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run().catch((error) => { console.error(`Storage reconciliation failed: ${error.message}`); process.exitCode = 1; });
