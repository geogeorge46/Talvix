import { DOMAIN_EVENTS } from '../constants/domainEvents.js';

const types = {
  [DOMAIN_EVENTS.DOCUMENT_VERIFICATION_REQUESTED]:'document-verification-requested',[DOMAIN_EVENTS.DOCUMENT_VERIFIED]:'document-verified',[DOMAIN_EVENTS.DOCUMENT_REJECTED]:'document-rejected',[DOMAIN_EVENTS.DOCUMENT_QUARANTINED]:'document-quarantined',
  [DOMAIN_EVENTS.ACCOUNT_REGISTERED]:'account-welcome',[DOMAIN_EVENTS.RECRUITER_APPROVED]:'recruiter-approved',[DOMAIN_EVENTS.RECRUITER_REJECTED]:'recruiter-rejected',[DOMAIN_EVENTS.RECRUITER_SUSPENDED]:'recruiter-suspended',[DOMAIN_EVENTS.COMPANY_VERIFIED]:'company-verified',[DOMAIN_EVENTS.COMPANY_REJECTED]:'company-rejected',[DOMAIN_EVENTS.COMPANY_SUSPENDED]:'company-suspended',[DOMAIN_EVENTS.COMPANY_TEAM_MEMBER_ADDED]:'team-member-added',[DOMAIN_EVENTS.COMPANY_TEAM_PERMISSIONS_UPDATED]:'team-permissions-updated',[DOMAIN_EVENTS.COMPANY_TEAM_MEMBER_REMOVED]:'team-member-removed',[DOMAIN_EVENTS.JOB_SUBMITTED]:'job-submitted',[DOMAIN_EVENTS.JOB_APPROVED]:'job-approved',[DOMAIN_EVENTS.JOB_REJECTED]:'job-rejected',[DOMAIN_EVENTS.JOB_PUBLISHED]:'job-published',[DOMAIN_EVENTS.JOB_PAUSED]:'job-paused',[DOMAIN_EVENTS.JOB_CLOSED]:'job-closed',[DOMAIN_EVENTS.APPLICATION_SUBMITTED]:'application-submitted',[DOMAIN_EVENTS.APPLICATION_UNDER_REVIEW]:'application-status-updated',[DOMAIN_EVENTS.APPLICATION_SHORTLISTED]:'application-shortlisted',[DOMAIN_EVENTS.APPLICATION_REJECTED]:'application-rejected',[DOMAIN_EVENTS.APPLICATION_WITHDRAWN]:'application-withdrawn',[DOMAIN_EVENTS.APPLICATION_HIRED]:'candidate-hired',[DOMAIN_EVENTS.ASSESSMENT_ASSIGNED]:'assessment-assigned',[DOMAIN_EVENTS.ASSESSMENT_RESULT_RELEASED]:'assessment-result-released',[DOMAIN_EVENTS.ASSESSMENT_EXPIRED]:'assessment-expired',[DOMAIN_EVENTS.ASSESSMENT_REMINDER]:'assessment-starting-soon',[DOMAIN_EVENTS.INTERVIEW_SCHEDULED]:'interview-scheduled',[DOMAIN_EVENTS.INTERVIEW_CANDIDATE_ACCEPTED]:'interview-confirmed',[DOMAIN_EVENTS.INTERVIEW_RESCHEDULE_REQUESTED]:'interview-reschedule-requested',[DOMAIN_EVENTS.INTERVIEW_RESCHEDULED]:'interview-rescheduled',[DOMAIN_EVENTS.INTERVIEW_CANCELLED]:'interview-cancelled',[DOMAIN_EVENTS.INTERVIEW_FEEDBACK_RELEASED]:'interview-feedback-released',[DOMAIN_EVENTS.INTERVIEW_REMINDER]:'interview-reminder',[DOMAIN_EVENTS.OFFER_APPROVAL_REQUESTED]:'offer-approval-requested',[DOMAIN_EVENTS.OFFER_APPROVED]:'offer-approved',[DOMAIN_EVENTS.OFFER_REJECTED]:'offer-rejected',[DOMAIN_EVENTS.OFFER_SENT]:'offer-sent',[DOMAIN_EVENTS.OFFER_VIEWED]:'offer-viewed',[DOMAIN_EVENTS.OFFER_NEGOTIATION_REQUESTED]:'offer-negotiation-requested',[DOMAIN_EVENTS.OFFER_REVISED]:'offer-revised',[DOMAIN_EVENTS.OFFER_ACCEPTED]:'offer-accepted',[DOMAIN_EVENTS.OFFER_DECLINED]:'offer-declined',[DOMAIN_EVENTS.OFFER_WITHDRAWN]:'offer-withdrawn',[DOMAIN_EVENTS.OFFER_HIRE_CONFIRMED]:'candidate-hired',[DOMAIN_EVENTS.OFFER_EXPIRY_REMINDER]:'offer-expiring-soon',
};

const formatTitle = (domain, action, payload) => {
  if (domain === 'interview') {
    if (action === 'scheduled') return '📅 Interview Scheduled';
    if (action === 'rescheduled') return '📅 Interview Rescheduled';
    if (action === 'cancelled') return '📅 Interview Cancelled';
    if (action === 'confirmed') return '📅 Interview Confirmed';
    if (action === 'feedback-released') return '💬 Interview Feedback Released';
    return '📅 Interview Update';
  }
  if (domain === 'assessment') {
    if (action === 'assigned') return '📋 Assessment Assigned';
    if (action === 'starting-soon' || action === 'reminder') return '⏰ Assessment Starting Soon';
    if (action === 'result-released' || action === 'result-ready') return '📊 Assessment Result Released';
    if (action === 'expired') return '⏰ Assessment Expired';
    return '📋 Assessment Notification';
  }
  if (domain === 'offer') {
    if (action === 'sent') return '📄 Job Offer Received';
    if (action === 'revised') return '📄 Revised Job Offer';
    if (action === 'accepted') return '🎉 Job Offer Accepted';
    if (action === 'declined') return '📄 Job Offer Declined';
    if (action === 'withdrawn') return '📄 Job Offer Withdrawn';
    return '📄 Job Offer Notification';
  }
  if (domain === 'application') {
    if (action === 'shortlisted') return '⭐ Application Shortlisted';
    if (action === 'under-review') return '👀 Application Under Review';
    if (action === 'rejected') return '❌ Application Update';
    if (action === 'hired') return '🎉 Candidate Hired';
    return '💼 Application Update';
  }
  const capDomain = domain.charAt(0).toUpperCase() + domain.slice(1);
  const capAction = action.replaceAll('-', ' ');
  return `${capDomain} ${capAction}`;
};

const formatMessage = (domain, action, payload) => {
  const company = payload.companyName ?? '';
  const job = payload.jobTitle ?? '';
  const prefix = company && job ? `${company} · ${job}` : company || job || '';

  if (domain === 'interview') {
    const round = payload.roundName ?? 'Interview';
    const dateStr = payload.startTime ? new Date(payload.startTime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '';
    const dateNotice = dateStr ? ` on ${dateStr}` : '';
    const detail = action === 'scheduled' ? `has been scheduled${dateNotice}`
      : action === 'rescheduled' ? `has been rescheduled${dateNotice}`
      : action === 'cancelled' ? 'has been cancelled'
      : action === 'confirmed' ? 'has been confirmed'
      : action === 'feedback-released' ? 'feedback has been released'
      : 'update';
    return prefix ? `${prefix}: ${round} ${detail}.` : `${round} ${detail}.`;
  }
  if (domain === 'assessment') {
    const title = payload.assessmentTitle ? `"${payload.assessmentTitle}"` : 'Assessment';
    const dateStr = payload.expiresAt ? new Date(payload.expiresAt).toLocaleDateString('en-US', { dateStyle: 'medium' }) : '';
    const dueNotice = dateStr ? ` (Due ${dateStr})` : '';
    const detail = action === 'assigned' ? `has been assigned to you${dueNotice}`
      : action === 'result-released' ? 'results are now available'
      : action === 'expired' ? 'has expired'
      : 'update';
    return prefix ? `${prefix}: ${title} ${detail}.` : `${title} ${detail}.`;
  }
  if (domain === 'offer') {
    const num = payload.offerNumber ? ` (${payload.offerNumber})` : '';
    const detail = action === 'sent' ? `An official job offer${num} has been issued`
      : action === 'revised' ? `A revised job offer${num} has been issued`
      : `Offer update${num}`;
    return prefix ? `${prefix}: ${detail}.` : `${detail}.`;
  }
  if (domain === 'application') {
    const statusText = action.replaceAll('-', ' ');
    return prefix ? `${prefix}: Application status changed to ${statusText}.` : `Application status changed to ${statusText}.`;
  }
  const subject = payload.jobTitle ?? payload.assessmentTitle ?? payload.companyName ?? payload.offerNumber ?? 'Talvix';
  return `${subject}: ${action.replaceAll('-', ' ')}.`;
};

export const notificationInputForEvent = (event, payload) => {
  const [domain, action] = event.split('.');
  const quarantineMessage = payload.status === 'infected'
    ? 'The document was identified as unsafe and has been restricted.'
    : payload.status === 'suspicious'
      ? 'The document was flagged for security review.'
      : 'The document has been temporarily restricted while it is reviewed.';

  const title = formatTitle(domain, action, payload);
  const message = event === DOMAIN_EVENTS.DOCUMENT_QUARANTINED ? quarantineMessage : formatMessage(domain, action, payload);

  return {
    type: types[event] ?? 'admin-alert',
    title,
    message,
    priority: ['suspended', 'cancelled', 'expired'].includes(action) ? 'high' : 'normal',
    source: ['account', 'recruiter'].includes(domain) ? 'auth' : ['company', 'job', 'application', 'assessment', 'interview', 'offer'].includes(domain) ? domain : 'admin',
    data: payload,
    variables: payload
  };
};

