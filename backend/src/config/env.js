import 'dotenv/config';
import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(5000),
  CLIENT_URL: z.url(),
  MONGODB_URI: z.string().trim().min(1, 'MONGODB_URI is required'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must contain at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must contain at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().trim().regex(/^\d+[smhd]$/, 'Use a duration such as 15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().trim().regex(/^\d+[smhd]$/, 'Use a duration such as 7d'),
  EMAIL_PROVIDER: z.enum(['resend', 'console', 'disabled']).default('disabled'),
  RESEND_API_KEY: z.string().trim().optional(),
  EMAIL_FROM_NAME: z.string().trim().min(1).default('Talvix'),
  EMAIL_FROM_ADDRESS: z.email().default('no-reply@example.com'),
  EMAIL_REPLY_TO: z.union([z.email(), z.literal('')]).default(''),
  EMAIL_ENABLED: z.enum(['true', 'false']).transform((value) => value === 'true').default(false),
  APP_FRONTEND_URL: z.url().default('http://localhost:5173'),
  EMAIL_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
  FILE_STORAGE_PROVIDER:z.enum(['disabled','memory','cloudinary']).default('disabled'),FILE_UPLOADS_ENABLED:z.enum(['true','false']).transform(v=>v==='true').default(false),CLOUDINARY_CLOUD_NAME:z.string().trim().optional(),CLOUDINARY_API_KEY:z.string().trim().optional(),CLOUDINARY_API_SECRET:z.string().trim().optional(),FILE_MAX_IMAGE_MB:z.coerce.number().positive().max(20).default(5),FILE_MAX_DOCUMENT_MB:z.coerce.number().positive().max(50).default(10),FILE_MAX_ASSESSMENT_ATTACHMENT_MB:z.coerce.number().positive().max(100).default(20),FILE_SIGNED_URL_TTL_SECONDS:z.coerce.number().int().min(60).max(3600).default(300),FILE_MAX_USER_STORAGE_MB:z.coerce.number().positive().max(1000).default(100),
}).refine((data) => data.JWT_ACCESS_SECRET !== data.JWT_REFRESH_SECRET, {
  message: 'Access and refresh token secrets must be different',
  path: ['JWT_REFRESH_SECRET'],
}).refine((data) => !data.EMAIL_ENABLED || data.EMAIL_PROVIDER !== 'resend' || Boolean(data.RESEND_API_KEY), { message: 'RESEND_API_KEY is required when Resend email is enabled', path: ['RESEND_API_KEY'] }).refine(data=>!data.FILE_UPLOADS_ENABLED||data.FILE_STORAGE_PROVIDER!=='cloudinary'||Boolean(data.CLOUDINARY_CLOUD_NAME&&data.CLOUDINARY_API_KEY&&data.CLOUDINARY_API_SECRET),{message:'Cloudinary credentials are required when Cloudinary uploads are enabled',path:['CLOUDINARY_API_SECRET']});
// Cloudinary credentials are conditional so disabled and memory modes remain self-contained.

const parsedEnvironment = environmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  const issues = parsedEnvironment.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');

  throw new Error(`Invalid environment configuration: ${issues}`);
}

export const env = Object.freeze(parsedEnvironment.data);
