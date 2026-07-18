import { z } from 'zod';

import { PUBLIC_REGISTRATION_ROLES } from '../constants/roles.js';
import { AppError } from '../shared/errors/AppError.js';

const emailSchema = z.email('A valid email address is required').trim().toLowerCase();
const passwordSchema = z
  .string()
  .min(8, 'Password must contain at least 8 characters')
  .max(72, 'Password must contain at most 72 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a special character');

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2).max(100),
    email: emailSchema,
    password: passwordSchema,
    role: z.enum(PUBLIC_REGISTRATION_ROLES),
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required').max(72),
  })
  .strict();

export const profileSchema = z
  .object({
    fullName: z.string().trim().min(2).max(100).optional(),
    avatar: z.url('Avatar must be a valid URL').nullable().optional(),
    profileCompleted: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, 'At least one profile field is required');

/** Validates a request body and replaces it with normalized data. */
export const validateBody = (schema) => (request, _response, next) => {
  const result = schema.safeParse(request.body);

  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.') || 'body',
      message: issue.message,
    }));

    return next(new AppError('Validation failed', 400, details));
  }

  request.body = result.data;
  return next();
};
