import { expect, it, vi } from 'vitest';
vi.mock('../src/config/env.js', () => ({ env: { FILE_UPLOADS_ENABLED: false, FILE_STORAGE_PROVIDER: 'disabled', FILE_SIGNED_URL_TTL_SECONDS: 300 } }));
const { uploadFile } = await import('../src/services/fileStorageProvider.service.js');
it('fails closed when file storage is disabled', () => { expect(() => uploadFile({ buffer: Buffer.from('x') })).toThrow('File uploads are disabled'); });
