import bcrypt from 'bcrypt';

const PASSWORD_SALT_ROUNDS = 12;

/** Hashes a plaintext password using the application work factor. */
export const hashPassword = async (password) => bcrypt.hash(password, PASSWORD_SALT_ROUNDS);

/** Compares a plaintext password with a stored bcrypt digest. */
export const verifyPassword = async (password, passwordHash) =>
  bcrypt.compare(password, passwordHash);
