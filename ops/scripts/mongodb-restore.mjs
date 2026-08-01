import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const mongoUri = process.env.MONGODB_URI;
const source = process.env.RESTORE_DIR;
if (!mongoUri) throw new Error('MONGODB_URI is required');
if (!source) throw new Error('RESTORE_DIR is required');

const restoreDir = resolve(source);
await access(restoreDir);

const args = ['--uri', mongoUri, restoreDir];
if (process.env.RESTORE_DROP === 'true') args.unshift('--drop');
if (process.env.RESTORE_GZIP !== 'false') args.unshift('--gzip');

const child = spawn('mongorestore', args, { stdio: 'inherit', shell: process.platform === 'win32' });
const code = await new Promise((resolveCode) => child.on('close', resolveCode));
if (code !== 0) process.exit(code ?? 1);

console.log(`MongoDB restore completed from ${restoreDir}`);
