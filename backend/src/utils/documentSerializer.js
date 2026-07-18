const candidateVerification = (document) => ({
  required: document.verification.required,
  status: document.verification.status,
  submittedAt: document.verification.submittedAt,
  reviewedAt: document.verification.reviewedAt,
  ...(document.verification.status === 'rejected' && { reason: document.verification.candidateSafeReason }),
});
export const serializeDocument = (document) => ({ id: document.id, category: document.category, purpose: document.purpose, displayName: document.displayName, originalFileName: document.originalFileName, mimeType: document.mimeType, sizeBytes: document.sizeBytes, status: document.status, verification: candidateVerification(document), scanStatus: document.malwareScan.status, version: document.version, isCurrent: document.isCurrent, entityType: document.entityType, entityId: document.entityId, access: document.access, createdAt: document.createdAt, updatedAt: document.updatedAt });
export const serializeVerificationDocument = (document, details = false) => ({ ...serializeDocument(document), owner: document.owner, company: document.company, ...(details && { reviewedBy: document.verification.reviewedBy, privateNotes: document.verification.privateNotes }) });
export const serializeAdminDocument = (document) => ({ ...serializeVerificationDocument(document, true), ownerRole: document.ownerRole, checksum: document.checksum, storage: { provider: document.storage.provider, publicId: `***${document.storage.publicId.slice(-8)}` }, statusHistory: document.statusHistory });
