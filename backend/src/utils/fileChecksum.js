import{createHash}from'node:crypto';export const calculateFileChecksum=buffer=>createHash('sha256').update(buffer).digest('hex');
