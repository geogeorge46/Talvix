import { randomBytes } from 'node:crypto';

/** Normalizes user-facing text into a safe URL slug. */
export const normalizeSlug = (value) => {
  const slug = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
  return slug || 'item';
};

/** Produces a unique slug using the supplied persistence lookup. */
export const generateUniqueSlug = async (value, exists) => {
  const base = normalizeSlug(value);
  if (!(await exists(base))) return base;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = `${base}-${randomBytes(3).toString('hex')}`;
    if (!(await exists(candidate))) return candidate;
  }
  throw new Error('Unable to generate a unique slug');
};
