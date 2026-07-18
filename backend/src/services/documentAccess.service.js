import { CANDIDATE_VISIBLE_OFFER_STATUSES } from '../constants/offer.js';
import { AppError } from '../shared/errors/AppError.js';

const blocked = (document) => ['deleted', 'quarantined', 'failed', 'replaced'].includes(document.status)
  || ['suspicious', 'infected'].includes(document.malwareScan.status);

/** Central policy gate used before entity-aware document views and downloads. */
export const authorizeDocumentAccess = ({ actor, document, action, context = {} }) => {
  if (blocked(document) || (document.status === 'archived' && !document.owner.equals(actor.id))) throw new AppError('Document not found', 404);
  if (actor.role === 'admin') return document;
  if (document.owner.equals(actor.id)) return document;
  if (context.company && document.company?.equals(context.company) && context.recruiter && ['company-private', 'candidate-visible', 'public-profile'].includes(document.access)) return document;
  if (context.candidate && document.access === 'candidate-visible') {
    if (document.entityType === 'interview-process' && context.interview?.candidate.equals(actor.id)) return document;
    if (document.entityType === 'offer' && context.offer?.candidate.equals(actor.id) && CANDIDATE_VISIBLE_OFFER_STATUSES.includes(context.offer.status) && (context.offer.status !== 'withdrawn' || context.offer.sentAt)) return document;
  }
  throw new AppError(action === 'download' ? 'Document not found' : 'Document not found', 404);
};
