import path from 'node:path';
import { DOCUMENT_MIMES, IMAGE_MIMES, RESUME_MIMES } from '../constants/document.js';
import { AppError } from '../shared/errors/AppError.js';

const extensions = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
};

const signatures = {
  'application/pdf': (b) => b.subarray(0, 5).toString() === '%PDF-',
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  'image/webp': (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP',
};

const extToMime = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.txt': 'text/plain',
};

export const sanitizeFileName = (value) => {
  const base = path.basename(String(value)).replace(/[^A-Za-z0-9._ -]/g, '_').slice(0, 200);
  const parts = base.split('.').filter(Boolean);
  if (parts.length < 2) throw new AppError('Invalid file name', 400);
  const ext = parts.pop();
  const nameOnly = parts.join('_');
  const name = `${nameOnly}.${ext}`;
  if (!name || name.startsWith('.')) throw new AppError('Invalid file name', 400);
  return name;
};

export const validateFile = (file, category, maxBytes) => {
  if (!file?.buffer?.length) throw new AppError('A non-empty file is required', 400);
  const name = sanitizeFileName(file.originalname);
  const ext = path.extname(name).toLowerCase();
  if ((!file.mimetype || file.mimetype === 'application/octet-stream') && extToMime[ext]) {
    file.mimetype = extToMime[ext];
  }
  const allowed = ['profile-photo', 'company-logo'].includes(category)
    ? IMAGE_MIMES
    : category === 'resume'
      ? RESUME_MIMES
      : [...DOCUMENT_MIMES, ...IMAGE_MIMES];
  if (!allowed.includes(file.mimetype)) throw new AppError('Unsupported file type', 400);
  if (!extensions[file.mimetype]?.includes(ext)) throw new AppError('File extension does not match its MIME type', 400);
  if (file.size > maxBytes) throw new AppError('File exceeds the permitted size', 413);
  if (signatures[file.mimetype] && !signatures[file.mimetype](file.buffer)) throw new AppError('File content does not match its declared type', 400);
  return { name, extension: ext.slice(1), mediaType: IMAGE_MIMES.includes(file.mimetype) ? 'image' : 'document' };
};

