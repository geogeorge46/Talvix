import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) throw new Error('MONGODB_URI is required');

const backupRoot = resolve(process.env.BACKUP_DIR ?? 'backups/mongodb');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputDir = resolve(backupRoot, stamp);

await mkdir(outputDir, { recursive: true });

const args = ['--uri', mongoUri, '--out', outputDir];
if (process.env.BACKUP_GZIP !== 'false') args.push('--gzip');

const child = spawn('mongodump', args, { stdio: 'inherit', shell: process.platform === 'win32' });
const code = await new Promise((resolveCode) => child.on('close', resolveCode));
if (code !== 0) process.exit(code ?? 1);

console.log(`MongoDB backup written to ${outputDir}`);
