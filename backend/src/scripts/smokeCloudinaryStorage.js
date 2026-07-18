import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { env } from '../config/env.js';
import { createSignedDownloadUrl, deleteFile, getFileMetadata, uploadFile } from '../services/fileStorageProvider.service.js';

const run = async () => {
  if (env.FILE_STORAGE_PROVIDER !== 'cloudinary' || !env.FILE_UPLOADS_ENABLED) throw new Error('Cloudinary storage is not enabled');
  const publicId = `talvix/smoke-tests/${randomUUID().replaceAll('-', '_')}`;
  let stored;
  try {
    stored = await uploadFile({ buffer: Buffer.from('Talvix storage smoke test'), fileName: 'smoke.txt', mimeType: 'text/plain', folder: 'talvix/smoke-tests', publicId, resourceType: 'raw', accessMode: 'private', metadata: { purpose: 'staging-smoke-test' } });
    const metadata = await getFileMetadata({ publicId: stored.publicId, resourceType: stored.resourceType });
    await createSignedDownloadUrl({ publicId: stored.publicId, resourceType: stored.resourceType, expiresAt: new Date(Date.now() + 60000), attachment: true });
    console.info(`Cloudinary smoke test passed: authenticated raw asset, ${Number(metadata.bytes ?? stored.bytes)} bytes.`);
  } finally {
    if (stored) { const result = await deleteFile({ publicId: stored.publicId, resourceType: stored.resourceType }); console.info(`Cloudinary smoke-test cleanup: ${result.deleted ? 'confirmed' : 'not confirmed'}.`); }
  }
};
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run().catch((error) => { console.error(`Cloudinary smoke test failed: ${error.message}`); process.exitCode = 1; });
