import React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { Card, Button, useToast } from '../../design-system';
import { useAuth } from '../../auth/AuthProvider';

export function RecruiterVerificationStatusPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const profileQuery = useQuery({
    queryKey: ['recruiter-profile', 'me'],
    queryFn: () => apiRequest<{ profile: any }>('/recruiters/me'),
  });

  const profile = profileQuery.data?.profile;
  const company = profile?.company;
  const recruiterStatus = profile?.user?.recruiterVerificationStatus ?? user?.recruiterVerificationStatus ?? 'none';
  const companyStatus = company?.verificationStatus ?? 'none';

  const isAnyRejected = recruiterStatus === 'rejected' || companyStatus === 'rejected';
  const isBothVerified = recruiterStatus === 'verified' && companyStatus === 'verified';
  
  let overallState: 'rejected' | 'verified' | 'pending' = 'pending';
  if (isAnyRejected) {
    overallState = 'rejected';
  } else if (isBothVerified) {
    overallState = 'verified';
  } else {
    overallState = 'pending';
  }

  const formattedDate = (dateString?: string) => {
    if (!dateString) return new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
    return new Date(dateString).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      {/* Header bar */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 24px',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-bg-alt)'
      }}>
        <div style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--color-action-primary)' }}>Talvix</div>
        <Button variant="quiet" onClick={async () => { await logout(); window.location.reload(); }}>
          Logout
        </Button>
      </header>

      <div style={{ maxWidth: '600px', margin: '60px auto', padding: '0 16px 40px' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <p style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Verification Status</p>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: '8px 0' }}>Legitimacy Review</h1>
      </div>

      {overallState === 'pending' && (
        <Card heading="Verification Submitted" headingLevel={2}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '16px' }}>
            <p style={{ color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
              Your recruiter and company information has been submitted for administrator review. We will verify your official domain matching and corporate details shortly.
            </p>

            <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 500 }}>Recruiter Verification</span>
                <span style={{
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  background: recruiterStatus === 'verified' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                  color: recruiterStatus === 'verified' ? 'rgb(16, 185, 129)' : 'rgb(245, 158, 11)'
                }}>
                  {recruiterStatus === 'verified' ? '✓ Verified' : '● Pending'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 500 }}>Company Verification</span>
                <span style={{
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  background: companyStatus === 'verified' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                  color: companyStatus === 'verified' ? 'rgb(16, 185, 129)' : 'rgb(245, 158, 11)'
                }}>
                  {companyStatus === 'verified' ? '✓ Verified' : '● Pending'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              <span>Submitted:</span>
              <strong>{formattedDate(profile?.updatedAt)}</strong>
            </div>

            <Button onClick={() => window.location.reload()} style={{ marginTop: '12px' }}>
              Refresh Status
            </Button>
          </div>
        </Card>
      )}

      {overallState === 'rejected' && (
        <Card heading="Verification Rejected" headingLevel={2}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '16px' }}>
            <p style={{ color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
              Unfortunately, your verification request was not approved by the administrator. Please review the status and reasons below, correct your details, and resubmit.
            </p>

            <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Recruiter block */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600 }}>Recruiter Verification</span>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: recruiterStatus === 'rejected' ? 'rgba(239, 68, 68, 0.1)' : recruiterStatus === 'verified' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                    color: recruiterStatus === 'rejected' ? 'rgb(239, 68, 68)' : recruiterStatus === 'verified' ? 'rgb(16, 185, 129)' : 'rgb(245, 158, 11)'
                  }}>
                    {recruiterStatus === 'rejected' ? '❌ Rejected' : recruiterStatus === 'verified' ? '✓ Verified' : '● Pending'}
                  </span>
                </div>
                {recruiterStatus === 'rejected' && (
                  <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.03)', borderLeft: '3px solid rgb(239, 68, 68)', borderRadius: '4px', marginTop: '4px' }}>
                    <span style={{ display: 'block', fontWeight: 600, color: 'rgb(239, 68, 68)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                      Rejection Reason
                    </span>
                    <p style={{ margin: 0, fontSize: '0.9rem', fontStyle: 'italic' }}>
                      {profile?.rejectionReason || 'No feedback provided by the administrator.'}
                    </p>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div style={{ height: '1px', background: 'var(--color-border)' }} />

              {/* Company block */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600 }}>Company Verification</span>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: companyStatus === 'rejected' ? 'rgba(239, 68, 68, 0.1)' : companyStatus === 'verified' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                    color: companyStatus === 'rejected' ? 'rgb(239, 68, 68)' : companyStatus === 'verified' ? 'rgb(16, 185, 129)' : 'rgb(245, 158, 11)'
                  }}>
                    {companyStatus === 'rejected' ? '❌ Rejected' : companyStatus === 'verified' ? '✓ Verified' : '● Pending'}
                  </span>
                </div>
                {companyStatus === 'rejected' && (
                  <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.03)', borderLeft: '3px solid rgb(239, 68, 68)', borderRadius: '4px', marginTop: '4px' }}>
                    <p style={{ margin: '0 0 6px 0', fontSize: '0.9rem' }}>
                      <strong>Company:</strong> {company?.name}
                    </p>
                    <span style={{ display: 'block', fontWeight: 600, color: 'rgb(239, 68, 68)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                      Reason for rejection
                    </span>
                    <p style={{ margin: 0, fontSize: '0.9rem', fontStyle: 'italic' }}>
                      {company?.rejectionReason || 'No feedback provided by the administrator.'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
              {recruiterStatus === 'rejected' && (
                <Button onClick={() => navigate('/recruiter/onboarding')} style={{ flex: 1 }}>
                  Edit Recruiter Profile
                </Button>
              )}
              {companyStatus === 'rejected' && (
                <Button onClick={() => navigate('/recruiter/onboarding?editCompany=true')} style={{ flex: 1 }}>
                  Edit Company Details
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {overallState === 'verified' && (
        <Card heading="Verification Approved" headingLevel={2}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '16px' }}>
            <p style={{ color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
              Your recruiter account and company membership are fully verified. You can now access your recruiter workspace.
            </p>

            <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ color: 'rgb(16, 185, 129)', fontWeight: 'bold' }}>✓</span>
                <span>Recruiter Identity Verified</span>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ color: 'rgb(16, 185, 129)', fontWeight: 'bold' }}>✓</span>
                <span>Corporate Entity Verified</span>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ color: 'rgb(16, 185, 129)', fontWeight: 'bold' }}>✓</span>
                <span>Company Membership Active</span>
              </div>
            </div>

            <Button onClick={() => navigate('/org')} style={{ marginTop: '12px' }}>
              Go to Workspace
            </Button>
          </div>
        </Card>
      )}
    </div>
  </div>
  );
}
