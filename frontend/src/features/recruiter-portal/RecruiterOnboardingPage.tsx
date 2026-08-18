import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../api/client';
import { Card, Button, TextField, TextArea, useToast } from '../../design-system';
import { useAuth } from '../../auth/AuthProvider';
import { ApiError } from '../../api/client';

export function RecruiterOnboardingPage() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Step 1 State: Recruiter Profile
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [designation, setDesignation] = useState('');
  const [phone, setPhone] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [bio, setBio] = useState('');

  // Step 2 Option State
  const [companyOption, setCompanyOption] = useState<'create' | 'join' | null>(null);

  // Step 2 State: Create Company
  const [companyName, setCompanyName] = useState('');
  const [website, setWebsite] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [industry, setIndustry] = useState('');
  const [companySize, setCompanySize] = useState('1-10');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [description, setDescription] = useState('');

  // Step 2 State: Join Company
  const [searchQuery, setSearchQuery] = useState('');
  const [joinStatus, setJoinStatus] = useState<string | null>(null);

  // Step 2 State: Edit Company
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [editCompanyName, setEditCompanyName] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editCompanyEmail, setEditCompanyEmail] = useState('');
  const [editIndustry, setEditIndustry] = useState('');
  const [editCompanySize, setEditCompanySize] = useState('1-10');
  const [editCountry, setEditCountry] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Load existing recruiter profile if any
  const profileQuery = useQuery({
    queryKey: ['recruiter-profile', 'me'],
    queryFn: () => apiRequest<{ profile: any }>('/recruiters/me'),
  });

  const associatedCompany = profileQuery.data?.profile?.company;

  useEffect(() => {
    if (associatedCompany) {
      setEditCompanyName(associatedCompany.name || '');
      setEditWebsite(associatedCompany.website || '');
      setEditCompanyEmail(associatedCompany.email || '');
      setEditIndustry(associatedCompany.industry || '');
      setEditCompanySize(associatedCompany.companySize || '1-10');
      setEditCountry(associatedCompany.headquarters?.country || '');
      setEditCity(associatedCompany.headquarters?.city || '');
      setEditDescription(associatedCompany.description || '');
    }
  }, [associatedCompany]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('editCompany') === 'true') {
      setStep(2);
      setIsEditingCompany(true);
    }
  }, []);

  const updateCompanyMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/companies/me', {
        method: 'PATCH',
        body: {
          name: editCompanyName,
          website: editWebsite || undefined,
          email: editCompanyEmail || undefined,
          industry: editIndustry,
          companySize: editCompanySize || undefined,
          headquarters: {
            city: editCity || undefined,
            country: editCountry || undefined,
          },
          description: editDescription || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.push({ title: 'Success', message: 'Company information updated and submitted for verification.', tone: 'success' });
      queryClient.invalidateQueries({ queryKey: ['recruiter-profile'] });
      setIsEditingCompany(false);
      setError(null);
    },
    onError: (err: any) => {
      setError(err instanceof ApiError ? err.message : 'Failed to update company details');
    },
  });

  const handleEditCompanySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCompanyName.trim()) return setError('Company name is required.');
    if (!editIndustry.trim()) return setError('Industry is required.');
    updateCompanyMutation.mutate();
  };

  useEffect(() => {
    if (profileQuery.data?.profile) {
      const p = profileQuery.data.profile;
      setDesignation(p.designation || '');
      setPhone(p.phone || '');
      setLinkedinUrl(p.linkedinUrl || '');
      setBio(p.bio || '');
    }
  }, [profileQuery.data]);

  // Fetch search results for join company
  const searchCompaniesQuery = useQuery({
    queryKey: ['companies-search', searchQuery],
    queryFn: () => apiRequest<{ companies: any[] }>('/companies?limit=10&search=' + encodeURIComponent(searchQuery)),
    enabled: searchQuery.length >= 2,
  });

  // Step 1 Mutation: Save Profile
  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      // 1. Update Full Name in user account
      await apiRequest('/auth/profile', {
        method: 'PATCH',
        body: { fullName },
      });
      // 2. Update Recruiter profile
      await apiRequest('/recruiters/me', {
        method: 'PATCH',
        body: { designation, phone, linkedinUrl, bio },
      });
    },
    onSuccess: () => {
      toast.push({ title: 'Success', message: 'Profile updated successfully', tone: 'success' });
      setStep(2);
      setError(null);
    },
    onError: (err: any) => {
      setError(err instanceof ApiError ? err.message : 'Failed to save profile details');
    },
  });

  // Step 2 Mutation: Create Company
  const createCompanyMutation = useMutation({
    mutationFn: async () => {
      return apiRequest<{ success: boolean; data: { company: any } }>('/companies', {
        method: 'POST',
        body: {
          name: companyName,
          website: website || undefined,
          email: companyEmail || undefined,
          industry,
          companySize: companySize || undefined,
          headquarters: {
            city: city || undefined,
            country: country || undefined,
          },
          description: description || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.push({ title: 'Success', message: 'Company created successfully', tone: 'success' });
      queryClient.invalidateQueries({ queryKey: ['recruiter-profile'] });
      setStep(3);
      setError(null);
    },
    onError: (err: any) => {
      setError(err instanceof ApiError ? err.message : 'Failed to create company');
    },
  });

  // Step 2 Mutation: Submit Join Request
  const joinCompanyMutation = useMutation({
    mutationFn: async (companyId: string) => {
      return apiRequest<{ success: boolean; message: string; data: any }>(
        `/companies/${companyId}/join-request`,
        { method: 'POST' }
      );
    },
    onSuccess: (res: any) => {
      setJoinStatus(res.message || 'Join request submitted. Please wait for company owner to approve.');
      toast.push({ title: 'Success', message: res.message || 'Join request submitted', tone: 'success' });
      queryClient.invalidateQueries({ queryKey: ['recruiter-profile'] });
      setError(null);
    },
    onError: (err: any) => {
      setError(err instanceof ApiError ? err.message : 'Failed to join company');
    },
  });

  // Step 3 Mutation: Submit Verification request
  const submitVerificationMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/recruiters/me/submit-verification', { method: 'POST' });
    },
    onSuccess: () => {
      toast.push({
        title: 'Verification Submitted',
        message: 'Your verification details have been submitted for Admin review.',
        tone: 'success',
      });
      // Force reload auth session state and redirect
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    },
    onError: (err: any) => {
      setError(err instanceof ApiError ? err.message : 'Failed to submit verification request.');
    },
  });

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return setError('Full Name is required.');
    if (!designation.trim()) return setError('Job Title is required.');
    if (!phone.trim()) return setError('Phone number is required.');
    saveProfileMutation.mutate();
  };

  const handleCompanySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return setError('Company name is required.');
    if (!industry.trim()) return setError('Industry is required.');
    createCompanyMutation.mutate();
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

      <div style={{ maxWidth: '640px', margin: '40px auto', padding: '0 16px 40px' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <p style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Onboarding Wizard</p>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: '8px 0' }}>Complete Recruiter Profile</h1>
        <p style={{ color: 'var(--color-text-muted)' }}>Set up your recruiter identity and business entity prior to administrator verification.</p>
      </div>

      {/* Step Indicator */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '15px', left: 0, right: 0, height: '2px', background: 'var(--color-border)', zIndex: 1 }} />
        <div style={{ position: 'absolute', top: '15px', left: 0, width: `${(step - 1) * 50}%`, height: '2px', background: 'var(--color-action-primary)', zIndex: 1, transition: 'width 0.3s ease' }} />
        {[1, 2, 3].map((s) => (
          <div key={s} style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: step >= s ? 'var(--color-action-primary)' : 'var(--color-bg)',
              border: step >= s ? '2px solid var(--color-action-primary)' : '2px solid var(--color-border)',
              color: step >= s ? '#fff' : 'var(--color-text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
            }}>
              {s}
            </div>
            <span style={{ fontSize: '0.75rem', marginTop: '6px', fontWeight: 500, color: step >= s ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
              {s === 1 ? 'Personal' : s === 2 ? 'Company' : 'Submit'}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ margin: '16px 0', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: 'rgb(239, 68, 68)', borderRadius: '6px', fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      {step === 1 && (
        <Card heading="Step 1 — Recruiter Profile" headingLevel={2}>
          <form onSubmit={handleProfileSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
            <TextField
              label="Full Name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <TextField
              label="Job Title / Designation"
              required
              placeholder="e.g. Talent Acquisition Manager"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
            />
            <TextField
              label="Phone Number"
              required
              placeholder="e.g. +1-234-567-8900"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <TextField
              label="LinkedIn Profile URL"
              type="url"
              placeholder="https://linkedin.com/in/username"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
            />
            <TextArea
              label="Biography"
              placeholder="Brief description of your hiring expertise..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
            <Button type="submit" disabled={saveProfileMutation.isPending} style={{ marginTop: '12px' }}>
              {saveProfileMutation.isPending ? 'Saving...' : 'Save & Continue'}
            </Button>
          </form>
        </Card>
      )}

      {step === 2 && (
        <Card heading="Step 2 — Company Selection" headingLevel={2}>
          {associatedCompany ? (
            isEditingCompany ? (
              <div style={{ marginTop: '16px' }}>
                <form onSubmit={handleEditCompanySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <TextField
                    label="Company Name"
                    required
                    value={editCompanyName}
                    onChange={(e) => setEditCompanyName(e.target.value)}
                  />
                  <TextField
                    label="Company Website"
                    type="url"
                    placeholder="https://example.com"
                    value={editWebsite}
                    onChange={(e) => setEditWebsite(e.target.value)}
                  />
                  <TextField
                    label="Company Email"
                    type="email"
                    placeholder="hr@company.com"
                    value={editCompanyEmail}
                    onChange={(e) => setEditCompanyEmail(e.target.value)}
                  />
                  <TextField
                    label="Industry"
                    required
                    placeholder="e.g. Information Technology"
                    value={editIndustry}
                    onChange={(e) => setEditIndustry(e.target.value)}
                  />
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Company Size</span>
                    <select
                      value={editCompanySize}
                      onChange={(e) => setEditCompanySize(e.target.value)}
                      style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
                    >
                      <option value="1-10">1-10 employees</option>
                      <option value="11-50">11-50 employees</option>
                      <option value="51-200">51-200 employees</option>
                      <option value="201-500">201-500 employees</option>
                      <option value="501-1000">501-1000 employees</option>
                      <option value="1001-5000">1001-5000 employees</option>
                      <option value="5000+">5000+ employees</option>
                    </select>
                  </label>
                  <TextField
                    label="Country"
                    placeholder="e.g. United States"
                    value={editCountry}
                    onChange={(e) => setEditCountry(e.target.value)}
                  />
                  <TextField
                    label="City"
                    placeholder="e.g. New York"
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                  />
                  <TextArea
                    label="Company Description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                  />
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
                    <Button variant="quiet" onClick={() => setIsEditingCompany(false)}>Cancel</Button>
                    <Button type="submit" disabled={updateCompanyMutation.isPending}>
                      {updateCompanyMutation.isPending ? 'Saving...' : 'Save & Resubmit'}
                    </Button>
                  </div>
                </form>
              </div>
            ) : (
              <div style={{ marginTop: '16px', textAlign: 'center' }}>
                <div style={{ padding: '16px', background: 'var(--color-bg-alt)', borderRadius: '6px', marginBottom: '16px' }}>
                  <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>Associated Company</p>
                  <p style={{ margin: '4px 0', fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-action-primary)' }}>{associatedCompany.name}</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Website: {associatedCompany.website || '—'}</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                    Status: <span style={{
                      fontWeight: 600,
                      color: associatedCompany.verificationStatus === 'rejected' ? 'rgb(239, 68, 68)' : associatedCompany.verificationStatus === 'verified' ? 'rgb(16, 185, 129)' : 'rgb(245, 158, 11)'
                    }}>
                      {associatedCompany.verificationStatus === 'rejected' ? '❌ Rejected' : associatedCompany.verificationStatus === 'verified' ? '✓ Verified' : '⏳ Pending'}
                    </span>
                  </p>

                  {associatedCompany.verificationStatus === 'rejected' && (
                    <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.05)', borderLeft: '3px solid rgb(239, 68, 68)', borderRadius: '4px', marginTop: '12px', textAlign: 'left' }}>
                      <span style={{ display: 'block', fontWeight: 600, color: 'rgb(239, 68, 68)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                        Reason for rejection:
                      </span>
                      <p style={{ margin: 0, fontSize: '0.95rem', fontStyle: 'italic' }}>
                        {associatedCompany.rejectionReason || 'No feedback provided by the administrator.'}
                      </p>
                    </div>
                  )}

                  {associatedCompany.verificationStatus === 'pending' && (
                    <p style={{ fontSize: '0.9rem', marginTop: '8px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                      "Waiting for administrator verification."
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <Button variant="quiet" onClick={() => setStep(1)}>Back</Button>
                  {associatedCompany.verificationStatus === 'rejected' ? (
                    <Button onClick={() => setIsEditingCompany(true)}>Edit Company Details</Button>
                  ) : associatedCompany.verificationStatus === 'pending' ? (
                    null
                  ) : (
                    <Button onClick={() => setStep(3)}>Continue to Submit</Button>
                  )}
                </div>
              </div>
            )
          ) : joinStatus ? (
            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <div style={{ padding: '16px', background: 'var(--color-bg-alt)', borderRadius: '6px', marginBottom: '16px' }}>
                <p style={{ fontWeight: 600, color: 'var(--color-action-primary)' }}>{joinStatus}</p>
                <p style={{ fontSize: '0.85rem', marginTop: '8px', color: 'var(--color-text-muted)' }}>Once the administrator or company owner approves your join request, you can refresh this page to complete verification submission.</p>
              </div>
              <Button variant="quiet" onClick={() => setJoinStatus(null)}>Back to company setup</Button>
            </div>
          ) : (
            <div style={{ marginTop: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div
                  onClick={() => setCompanyOption('create')}
                  style={{
                    border: companyOption === 'create' ? '2px solid var(--color-action-primary)' : '2px solid var(--color-border)',
                    borderRadius: '8px',
                    padding: '16px',
                    cursor: 'pointer',
                    textAlign: 'center',
                    background: companyOption === 'create' ? 'var(--color-bg-alt)' : 'transparent',
                  }}
                >
                  <strong style={{ display: 'block', fontSize: '1.1rem' }}>Create Company</strong>
                  <small style={{ color: 'var(--color-text-muted)' }}>Register a new corporate workspace owned by you.</small>
                </div>
                <div
                  onClick={() => setCompanyOption('join')}
                  style={{
                    border: companyOption === 'join' ? '2px solid var(--color-action-primary)' : '2px solid var(--color-border)',
                    borderRadius: '8px',
                    padding: '16px',
                    cursor: 'pointer',
                    textAlign: 'center',
                    background: companyOption === 'join' ? 'var(--color-bg-alt)' : 'transparent',
                  }}
                >
                  <strong style={{ display: 'block', fontSize: '1.1rem' }}>Join Company</strong>
                  <small style={{ color: 'var(--color-text-muted)' }}>Search and request to join an existing corporate workspace.</small>
                </div>
              </div>

              {companyOption === 'create' && (
                <form onSubmit={handleCompanySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <TextField
                    label="Company Name"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                  <TextField
                    label="Company Website"
                    type="url"
                    placeholder="https://example.com"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                  <TextField
                    label="Company Email"
                    type="email"
                    placeholder="hr@company.com"
                    value={companyEmail}
                    onChange={(e) => setCompanyEmail(e.target.value)}
                  />
                  <TextField
                    label="Industry"
                    required
                    placeholder="e.g. Information Technology"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                  />
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Company Size</span>
                    <select
                      value={companySize}
                      onChange={(e) => setCompanySize(e.target.value)}
                      style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
                    >
                      <option value="1-10">1-10 employees</option>
                      <option value="11-50">11-50 employees</option>
                      <option value="51-200">51-200 employees</option>
                      <option value="201-500">201-500 employees</option>
                      <option value="501-1000">501-1000 employees</option>
                      <option value="1001-5000">1001-5000 employees</option>
                      <option value="5000+">5000+ employees</option>
                    </select>
                  </label>
                  <TextField
                    label="Country"
                    placeholder="e.g. United States"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  />
                  <TextField
                    label="City"
                    placeholder="e.g. New York"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                  <TextArea
                    label="Company Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
                    <Button variant="quiet" onClick={() => setStep(1)}>Back</Button>
                    <Button type="submit" disabled={createCompanyMutation.isPending}>
                      {createCompanyMutation.isPending ? 'Creating...' : 'Create & Continue'}
                    </Button>
                  </div>
                </form>
              )}

              {companyOption === 'join' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <TextField
                    label="Search Company"
                    placeholder="Type at least 2 characters to search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />

                  {searchCompaniesQuery.isLoading ? (
                    <div>Searching companies...</div>
                  ) : searchCompaniesQuery.data?.companies?.length ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                      {searchCompaniesQuery.data.companies.map((c: any) => (
                        <div key={c._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid var(--color-border)', borderRadius: '6px' }}>
                          <div>
                            <strong>{c.name}</strong>
                            <small style={{ display: 'block', color: 'var(--color-text-muted)' }}>{c.website || 'No Website'} · {c.industry || 'No Industry'}</small>
                          </div>
                          <Button
                            variant="quiet"
                            disabled={joinCompanyMutation.isPending}
                            onClick={() => joinCompanyMutation.mutate(c._id)}
                          >
                            Join Request
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : searchQuery.length >= 2 ? (
                    <div style={{ color: 'var(--color-text-muted)' }}>No companies found. Try another search query.</div>
                  ) : null}

                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
                    <Button variant="quiet" onClick={() => setStep(1)}>Back</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {step === 3 && (
        <Card heading="Step 3 — Review & Submit" headingLevel={2}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
            <p>Please review your details. Once submitted, your profile will be sent to the system administrator for legitimacy review.</p>

            <section style={{ border: '1px solid var(--color-border)', borderRadius: '6px', padding: '16px' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '1.1rem', fontWeight: 600 }}>Personal Details</h3>
              <dl style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><dt style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}>Name</dt><dd style={{ margin: 0 }}>{fullName}</dd></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><dt style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}>Job Title</dt><dd style={{ margin: 0 }}>{designation}</dd></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><dt style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}>Phone</dt><dd style={{ margin: 0 }}>{phone}</dd></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><dt style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}>LinkedIn</dt><dd style={{ margin: 0 }}>{linkedinUrl || '—'}</dd></div>
              </dl>
            </section>

            <section style={{ border: '1px solid var(--color-border)', borderRadius: '6px', padding: '16px' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '1.1rem', fontWeight: 600 }}>Company Details</h3>
              <dl style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><dt style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}>Company Name</dt><dd style={{ margin: 0 }}>{associatedCompany?.name || '—'}</dd></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><dt style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}>Website</dt><dd style={{ margin: 0 }}>{associatedCompany?.website || '—'}</dd></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><dt style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}>Industry</dt><dd style={{ margin: 0 }}>{associatedCompany?.industry || '—'}</dd></div>
              </dl>
            </section>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
              <Button variant="quiet" onClick={() => setStep(2)}>Back</Button>
              <Button
                onClick={() => submitVerificationMutation.mutate()}
                disabled={submitVerificationMutation.isPending || !associatedCompany}
              >
                {submitVerificationMutation.isPending ? 'Submitting...' : 'Submit for Verification'}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  </div>
  );
}
