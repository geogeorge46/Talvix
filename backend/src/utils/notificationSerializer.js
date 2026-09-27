export const serializeNotification = (n) => {
  const priorityMap = {
    urgent: 'critical',
    high: 'high',
    normal: 'medium',
    low: 'low'
  };

  const serialized = {
    id: n.id,
    type: n.type,
    category: n.category,
    priority: priorityMap[n.priority] || 'medium',
    title: n.title,
    message: n.message,
    data: n.data || {},
    read: n.read,
    readAt: n.readAt,
    archived: n.archived,
    archivedAt: n.archivedAt,
    createdAt: n.createdAt,
    actions: []
  };

  // Determine entity identifiers
  const entityId = n.data?.applicationId || n.data?.jobId || n.data?.interviewId || n.data?.claimId || n.data?.invitationId || n.id;

  // Map actionable contextual buttons
  if (n.type === 'application-submitted' || n.type === 'application-shortlisted') {
    serialized.actions = [
      { label: 'View Candidate', type: 'link', path: `/org/applications/${entityId}` },
      { label: 'Schedule Interview', type: 'link', path: `/org/interviews/new?applicationId=${entityId}` },
      { label: 'Reject Candidate', type: 'action', method: 'PATCH', path: `/api/v1/applications/${entityId}/status`, body: { status: 'rejected' } }
    ];
  } else if (n.type === 'interview-scheduled' || n.type === 'interview-reminder' || n.type === 'interview-rescheduled') {
    const actionPath = n.data?.actionUrl || (n.data?.meetingUrl ?? '/candidate/interviews');
    serialized.actions = [
      { label: 'View Interview Details', type: 'link', path: actionPath }
    ];
    if (n.data?.meetingUrl) {
      serialized.actions.unshift({ label: 'Join Meeting', type: 'link', path: n.data.meetingUrl });
    }
  } else if (n.type === 'company-claim-submitted' || n.type === 'security-alert') {
    serialized.actions = [
      { label: 'View Claim', type: 'link', path: `/admin/claims` }
    ];
  } else if (n.type === 'recruiter-invite' || n.type === 'recruiter-invited') {
    serialized.actions = [
      { label: 'Accept', type: 'action', method: 'POST', path: `/api/v1/companies/invitations/${entityId}/accept` },
      { label: 'Decline', type: 'action', method: 'POST', path: `/api/v1/companies/invitations/${entityId}/decline` }
    ];
  } else if (n.type === 'assessment-assigned' || n.type === 'assessment-starting-soon') {
    const actionPath = n.data?.actionUrl || `/candidate/assessments/${n.data?.assignmentId || ''}`;
    serialized.actions = [
      { label: 'Start Assessment', type: 'link', path: actionPath }
    ];
  } else if (n.type === 'assessment-result-released' || n.type === 'assessment-result-ready') {
    const actionPath = n.data?.actionUrl || `/candidate/assessments/${n.data?.assignmentId || ''}`;
    serialized.actions = [
      { label: 'View Assessment Result', type: 'link', path: actionPath }
    ];
  } else if (n.type === 'offer-sent' || n.type === 'offer-revised') {
    const actionPath = n.data?.actionUrl || `/candidate/offers/${n.data?.offerId || ''}`;
    serialized.actions = [
      { label: 'View Offer', type: 'link', path: actionPath }
    ];
  }

  return serialized;
};

export const maskEmail = (value) => {
  const [name, domain] = String(value).split('@');
  return domain ? `${name.slice(0, 2)}***@${domain}` : '***';
};

export const serializeAdminNotification = (n, email) => ({
  ...serializeNotification(n),
  recipient: n.recipient,
  emailDelivery: {
    status: n.emailDelivery.status,
    attempts: n.emailDelivery.attempts,
    failureCode: n.emailDelivery.failureCode
  },
  recipientEmail: email ? maskEmail(email) : undefined
});
