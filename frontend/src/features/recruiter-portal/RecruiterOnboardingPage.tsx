import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { Card, Button, TextField, TextArea, useToast } from '../../design-system';
import { useAuth } from '../../auth/AuthProvider';
import { ApiError } from '../../api/client';

export function RecruiterOnboardingPage() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();

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
  const [legalName, setLegalName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [entityType, setEntityType] = useState('private_limited');
  const [cin, setCin] = useState('');
  const [gstin, setGstin] = useState('');
  const [state, setState] = useState('');
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
  const [editLegalName, setEditLegalName] = useState('');
  const [editTradeName, setEditTradeName] = useState('');
  const [editEntityType, setEditEntityType] = useState('private_limited');
  const [editCin, setEditCin] = useState('');
  const [editGstin, setEditGstin] = useState('');
  const [editState, setEditState] = useState('');
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
      setEditLegalName(associatedCompany.legalName || '');
      setEditTradeName(associatedCompany.tradeName || '');
      setEditEntityType(associatedCompany.entityType || 'private_limited');
      setEditCin(associatedCompany.cin || '');
      setEditGstin(associatedCompany.gstin || '');
      setEditState(associatedCompany.registeredAddress?.state || associatedCompany.headquarters?.state || '');
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
          legalName: editLegalName || undefined,
          tradeName: editTradeName || undefined,
          entityType: editEntityType,
          cin: editCin ? editCin.trim().toUpperCase() : undefined,
          gstin: editGstin ? editGstin.trim().toUpperCase() : undefined,
          registrationCountry: editCountry || 'IN',
          registeredAddress: {
            city: editCity || undefined,
            state: editState || undefined,
            country: editCountry || undefined,
          },
          website: editWebsite || undefined,
          email: editCompanyEmail || undefined,
          industry: editIndustry,
          companySize: editCompanySize || undefined,
          headquarters: {
            city: editCity || undefined,
            state: editState || undefined,
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
          legalName: legalName || undefined,
          tradeName: tradeName || undefined,
          entityType,
          cin: cin ? cin.trim().toUpperCase() : undefined,
          gstin: gstin ? gstin.trim().toUpperCase() : undefined,
          registrationCountry: country || 'IN',
          registeredAddress: {
            city: city || undefined,
            state: state || undefined,
            country: country || undefined,
          },
          website: website || undefined,
          email: companyEmail || undefined,
          industry,
          companySize: companySize || undefined,
          headquarters: {
            city: city || undefined,
            state: state || undefined,
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

  const steps = [
    { number: 1, title: 'Personal', subtitle: 'Recruiter details' },
    { number: 2, title: 'Company', subtitle: 'Corporate entity' },
    { number: 3, title: 'Submit', subtitle: 'Review & verify' },
  ];

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 font-sans antialiased flex flex-col">
      {/* Redesigned Modern Navigation Bar */}
      <header className="sticky top-0 z-30 w-full border-b border-slate-200/90 bg-white/95 backdrop-blur-md shadow-xs transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Left: Brand Logo + Back to Home Button + Breadcrumbs */}
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <Link
              to="/"
              title="Return to Talvix Home"
              className="flex items-center gap-2.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded-xl"
            >
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-900 group-hover:bg-black text-white shadow-md shadow-slate-900/20 transition-all group-hover:scale-105">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2L2 6v6c0 5.52 4.48 10 9 10s9-4.48 9-10V6l-9-4zm0 2.5l7 3.1v4.4c0 4.1-3 7.8-7 8.5-4-.7-7-4.4-7-8.5V7.6l7-3.1z" />
                  <path d="M11 7h2v6h-2zM11 14h2v2h-2z" />
                </svg>
              </div>
              <span className="text-xl font-black tracking-tight text-slate-900 group-hover:text-emerald-700 transition-colors">
                Talvix
              </span>
            </Link>

            <div className="h-5 w-px bg-slate-200 hidden sm:block" />

            {/* Prominent Back to Home Button */}
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 active:bg-slate-200 rounded-lg border border-slate-300/80 shadow-2xs transition-all"
            >
              <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Home</span>
            </Link>

            {/* Breadcrumb nav on larger screens */}
            <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <Link to="/" className="hover:text-slate-700 transition-colors">Home</Link>
              <span>/</span>
              <span className="text-slate-600 font-semibold">Recruiter Portal</span>
              <span>/</span>
              <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                Onboarding Setup
              </span>
            </nav>
          </div>

          {/* Right: Verification Status Link + User Info & Logout */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link
              to="/recruiter/verification-status"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-transparent hover:border-slate-200 transition-all"
            >
              <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Status Check</span>
            </Link>

            {user && (
              <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-slate-200">
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                  {user.fullName?.charAt(0).toUpperCase() || 'R'}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-slate-800 leading-tight max-w-[120px] truncate">
                    {user.fullName || 'Recruiter'}
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider">
                    Recruiter
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={async () => {
                await logout();
                window.location.reload();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 active:bg-rose-100 rounded-lg border border-rose-200/80 transition-all cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Page Hero Header */}
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold mb-3 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            ONBOARDING WIZARD
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
            Complete Recruiter Profile
          </h1>
          <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto">
            Set up your recruiter identity and business entity prior to administrator verification to unlock the full hiring workspace.
          </p>

          <div className="mt-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-emerald-700 transition-colors"
            >
              <span>Need to pause?</span>
              <span className="underline">Save progress & return home</span>
              <span>&rarr;</span>
            </Link>
          </div>
        </div>

        {/* Stepper Navigation */}
        <div className="mb-8 max-w-2xl mx-auto">
          <div className="relative">
            {/* Background line */}
            <div className="absolute top-5 left-10 right-10 h-0.5 bg-slate-200 -z-0" />
            {/* Active progress line */}
            <div
              className="absolute top-5 left-10 h-0.5 bg-emerald-600 -z-0 transition-all duration-300 ease-out"
              style={{
                width: step === 1 ? '0%' : step === 2 ? '50%' : 'calc(100% - 5rem)',
              }}
            />

            <div className="relative z-10 flex justify-between items-start">
              {steps.map((s) => {
                const isCompleted = step > s.number;
                const isCurrent = step === s.number;
                return (
                  <button
                    key={s.number}
                    type="button"
                    onClick={() => {
                      if (step > s.number) setStep(s.number);
                    }}
                    disabled={step < s.number}
                    className={`flex flex-col items-center group transition-all ${
                      isCompleted ? 'cursor-pointer' : isCurrent ? 'cursor-default' : 'cursor-not-allowed opacity-60'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full font-bold text-sm flex items-center justify-center transition-all shadow-sm ${
                        isCompleted
                          ? 'bg-emerald-600 text-white ring-4 ring-emerald-100 group-hover:scale-105'
                          : isCurrent
                          ? 'bg-slate-900 text-white ring-4 ring-slate-100 scale-105 shadow-md'
                          : 'bg-white border-2 border-slate-300 text-slate-400'
                      }`}
                    >
                      {isCompleted ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        s.number
                      )}
                    </div>
                    <span
                      className={`text-xs mt-2 font-bold ${
                        isCurrent
                          ? 'text-slate-900'
                          : isCompleted
                          ? 'text-emerald-700 group-hover:underline'
                          : 'text-slate-400'
                      }`}
                    >
                      {s.title}
                    </span>
                    <span className="hidden sm:block text-[11px] text-slate-500 font-normal">
                      {s.subtitle}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3 shadow-xs">
            <svg className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1 font-medium">{error}</div>
            <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-800 font-bold">&times;</button>
          </div>
        )}

        {/* ================= STEP 1: PERSONAL DETAILS ================= */}
        {step === 1 && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xl shadow-slate-100 p-6 sm:p-8">
            <div className="border-b border-slate-100 pb-4 mb-6">
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Step 1 of 3</span>
              <h2 className="text-xl font-bold text-slate-900 mt-0.5">Recruiter Identity Profile</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Provide your professional hiring credentials. This information is displayed to candidates and verified by administrators.
              </p>
            </div>

            <form onSubmit={handleProfileSubmit} className="flex flex-col gap-5">
              <TextField
                label="Full Name"
                required
                placeholder="e.g. Robin Jose"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
              <TextField
                label="Job Title / Designation"
                required
                placeholder="e.g. Head of Talent Acquisition"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
              />
              <TextField
                label="Direct Phone Number"
                required
                placeholder="e.g. +91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <TextField
                label="LinkedIn Profile URL"
                type="url"
                placeholder="https://linkedin.com/in/yourname"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
              />
              <TextArea
                label="Professional Biography"
                placeholder="Brief summary of your recruiting expertise, domain specializations, and hiring focus..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />

              {/* Step 1 Actions & Navigation */}
              <div className="flex items-center justify-between pt-6 mt-4 border-t border-slate-100">
                <Link
                  to="/"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
                >
                  <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  <span>Back to Home</span>
                </Link>

                <Button
                  type="submit"
                  disabled={saveProfileMutation.isPending}
                  className="h-11 px-6 bg-slate-900 hover:bg-black text-white font-bold rounded-xl shadow-md transition-all active:scale-[0.99]"
                >
                  {saveProfileMutation.isPending ? 'Saving Details...' : 'Save & Continue to Company →'}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* ================= STEP 2: COMPANY SELECTION ================= */}
        {step === 2 && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xl shadow-slate-100 p-6 sm:p-8">
            <div className="border-b border-slate-100 pb-4 mb-6">
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Step 2 of 3</span>
              <h2 className="text-xl font-bold text-slate-900 mt-0.5">Corporate Entity Setup</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Link your recruiter account to a registered company workspace to manage jobs and candidates.
              </p>
            </div>

            {associatedCompany ? (
              isEditingCompany ? (
                <div>
                  <form onSubmit={handleEditCompanySubmit} className="flex flex-col gap-4">
                    <TextField
                      label="Company Brand Name"
                      required
                      value={editCompanyName}
                      onChange={(e) => setEditCompanyName(e.target.value)}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <TextField
                        label="Legal Entity Name"
                        placeholder="e.g. Acme Technologies Private Limited"
                        value={editLegalName}
                        onChange={(e) => setEditLegalName(e.target.value)}
                      />
                      <TextField
                        label="Trading Name (if different)"
                        placeholder="e.g. Acme Tech"
                        value={editTradeName}
                        onChange={(e) => setEditTradeName(e.target.value)}
                      />
                    </div>
                    <label className="flex flex-col gap-1.5 text-xs font-bold text-slate-700">
                      <span>Legal Entity Type</span>
                      <select
                        value={editEntityType}
                        onChange={(e) => setEditEntityType(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                      >
                        <option value="private_limited">Private Limited Company</option>
                        <option value="public_limited">Public Limited Company</option>
                        <option value="llp">Limited Liability Partnership (LLP)</option>
                        <option value="proprietorship">Sole Proprietorship</option>
                        <option value="partnership">Partnership Firm</option>
                        <option value="other">Other Entity</option>
                      </select>
                    </label>

                    {(editEntityType === 'private_limited' || editEntityType === 'public_limited') && (
                      <TextField
                        label="Corporate Identification Number (CIN)"
                        placeholder="e.g. U72200MH2020PTC123456"
                        value={editCin}
                        onChange={(e) => setEditCin(e.target.value)}
                      />
                    )}
                    {editEntityType === 'llp' && (
                      <TextField
                        label="LLP Identification Number (LLPIN)"
                        placeholder="e.g. AAA-1234"
                        value={editCin}
                        onChange={(e) => setEditCin(e.target.value)}
                      />
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <TextField
                        label="GSTIN (Goods & Services Tax)"
                        placeholder="e.g. 27AAPCU1234P1ZV (Optional)"
                        value={editGstin}
                        onChange={(e) => setEditGstin(e.target.value)}
                      />
                      <TextField
                        label="Registered State"
                        placeholder="e.g. Karnataka"
                        value={editState}
                        onChange={(e) => setEditState(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <TextField
                        label="Company Website"
                        type="url"
                        placeholder="https://example.com"
                        value={editWebsite}
                        onChange={(e) => setEditWebsite(e.target.value)}
                      />
                      <TextField
                        label="Official Company Email"
                        type="email"
                        placeholder="careers@company.com"
                        value={editCompanyEmail}
                        onChange={(e) => setEditCompanyEmail(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <TextField
                        label="Industry"
                        required
                        placeholder="e.g. Software & Technology"
                        value={editIndustry}
                        onChange={(e) => setEditIndustry(e.target.value)}
                      />
                      <label className="flex flex-col gap-1.5 text-xs font-bold text-slate-700">
                        <span>Company Size</span>
                        <select
                          value={editCompanySize}
                          onChange={(e) => setEditCompanySize(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
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
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <TextField
                        label="Country"
                        placeholder="e.g. India"
                        value={editCountry}
                        onChange={(e) => setEditCountry(e.target.value)}
                      />
                      <TextField
                        label="City"
                        placeholder="e.g. Bangalore"
                        value={editCity}
                        onChange={(e) => setEditCity(e.target.value)}
                      />
                    </div>

                    <TextArea
                      label="Company Description"
                      placeholder="Describe what your organization builds and the company mission..."
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                    />

                    <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-2">
                      <Button variant="quiet" onClick={() => setIsEditingCompany(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={updateCompanyMutation.isPending}>
                        {updateCompanyMutation.isPending ? 'Saving...' : 'Save & Resubmit'}
                      </Button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 mb-6 text-left">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Associated Company</span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        associatedCompany.verificationStatus === 'rejected'
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : associatedCompany.verificationStatus === 'verified'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}>
                        {associatedCompany.verificationStatus === 'rejected' ? '❌ Rejected' : associatedCompany.verificationStatus === 'verified' ? '✓ Verified' : '⏳ Pending Review'}
                      </span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900">{associatedCompany.name}</h3>
                    <p className="text-xs text-slate-500 mt-1">Website: {associatedCompany.website || '—'}</p>
                    <p className="text-xs text-slate-500">Industry: {associatedCompany.industry || '—'}</p>

                    {associatedCompany.verificationStatus === 'rejected' && (
                      <div className="mt-4 p-3 rounded-lg bg-rose-50 border-l-4 border-rose-500 text-rose-800 text-xs">
                        <strong>Reason for Rejection:</strong>
                        <p className="mt-1 italic">{associatedCompany.rejectionReason || 'No specific feedback provided by administrator.'}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <Button variant="quiet" onClick={() => setStep(1)}>
                        &larr; Back to Personal
                      </Button>
                      <Link
                        to="/"
                        className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
                      >
                        Back to Home
                      </Link>
                    </div>

                    <div className="flex items-center gap-2">
                      {associatedCompany.verificationStatus === 'rejected' ? (
                        <Button onClick={() => setIsEditingCompany(true)}>
                          Edit Company Details
                        </Button>
                      ) : (
                        <Button onClick={() => setStep(3)} className="bg-slate-900 text-white font-bold">
                          Continue to Review &rarr;
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )
            ) : joinStatus ? (
              <div className="text-center py-6">
                <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 mb-6">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-emerald-900 mb-1">{joinStatus}</h3>
                  <p className="text-xs text-emerald-700 max-w-md mx-auto">
                    Once the administrator or company owner reviews and approves your join request, you can refresh this page to complete verification submission.
                  </p>
                </div>

                <div className="flex items-center justify-center gap-3">
                  <Button variant="quiet" onClick={() => setJoinStatus(null)}>
                    Back to Selection
                  </Button>
                  <Link
                    to="/"
                    className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl"
                  >
                    Back to Home
                  </Link>
                </div>
              </div>
            ) : (
              <div>
                {/* Visual Option Selector: Create vs Join */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div
                    onClick={() => setCompanyOption('create')}
                    className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col items-center text-center ${
                      companyOption === 'create'
                        ? 'border-emerald-600 bg-emerald-50/50 shadow-md ring-4 ring-emerald-100/60'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${
                      companyOption === 'create' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <strong className="text-base text-slate-900">Create New Company</strong>
                    <span className="text-xs text-slate-500 mt-1">Register a new corporate workspace owned by your organization.</span>
                  </div>

                  <div
                    onClick={() => setCompanyOption('join')}
                    className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col items-center text-center ${
                      companyOption === 'join'
                        ? 'border-emerald-600 bg-emerald-50/50 shadow-md ring-4 ring-emerald-100/60'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${
                      companyOption === 'join' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <strong className="text-base text-slate-900">Join Existing Company</strong>
                    <span className="text-xs text-slate-500 mt-1">Search and request to join your company's existing workspace.</span>
                  </div>
                </div>

                {/* Sub-form: Create Company */}
                {companyOption === 'create' && (
                  <form onSubmit={handleCompanySubmit} className="flex flex-col gap-4 mt-6">
                    <TextField
                      label="Company Brand Name"
                      required
                      placeholder="e.g. Talvix Technologies"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <TextField
                        label="Legal Entity Name"
                        placeholder="e.g. Talvix Technologies Private Limited"
                        value={legalName}
                        onChange={(e) => setLegalName(e.target.value)}
                      />
                      <TextField
                        label="Trading Name (if different)"
                        placeholder="e.g. Talvix Tech"
                        value={tradeName}
                        onChange={(e) => setTradeName(e.target.value)}
                      />
                    </div>

                    <label className="flex flex-col gap-1.5 text-xs font-bold text-slate-700">
                      <span>Legal Entity Type</span>
                      <select
                        value={entityType}
                        onChange={(e) => setEntityType(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                      >
                        <option value="private_limited">Private Limited Company</option>
                        <option value="public_limited">Public Limited Company</option>
                        <option value="llp">Limited Liability Partnership (LLP)</option>
                        <option value="proprietorship">Sole Proprietorship</option>
                        <option value="partnership">Partnership Firm</option>
                        <option value="other">Other Entity</option>
                      </select>
                    </label>

                    {(entityType === 'private_limited' || entityType === 'public_limited') && (
                      <TextField
                        label="Corporate Identification Number (CIN)"
                        placeholder="e.g. U72200KA2024PTC123456"
                        value={cin}
                        onChange={(e) => setCin(e.target.value)}
                      />
                    )}
                    {entityType === 'llp' && (
                      <TextField
                        label="LLP Identification Number (LLPIN)"
                        placeholder="e.g. AAA-1234"
                        value={cin}
                        onChange={(e) => setCin(e.target.value)}
                      />
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <TextField
                        label="GSTIN (Goods & Services Tax)"
                        placeholder="e.g. 29ABCDE1234F1Z5 (Optional)"
                        value={gstin}
                        onChange={(e) => setGstin(e.target.value)}
                      />
                      <TextField
                        label="Registered State"
                        placeholder="e.g. Karnataka"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <TextField
                        label="Company Website"
                        type="url"
                        placeholder="https://talvixtech.com"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                      />
                      <TextField
                        label="Official Company Email"
                        type="email"
                        placeholder="careers@talvixtech.com"
                        value={companyEmail}
                        onChange={(e) => setCompanyEmail(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <TextField
                        label="Industry"
                        required
                        placeholder="e.g. Software & Technology"
                        value={industry}
                        onChange={(e) => setIndustry(e.target.value)}
                      />
                      <label className="flex flex-col gap-1.5 text-xs font-bold text-slate-700">
                        <span>Company Size</span>
                        <select
                          value={companySize}
                          onChange={(e) => setCompanySize(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
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
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <TextField
                        label="Country"
                        placeholder="e.g. India"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                      />
                      <TextField
                        label="City"
                        placeholder="e.g. Bangalore"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                      />
                    </div>

                    <TextArea
                      label="Company Description"
                      placeholder="Describe what your organization builds and the company mission..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />

                    <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-4">
                      <div className="flex items-center gap-2">
                        <Button variant="quiet" onClick={() => setStep(1)}>
                          &larr; Back to Personal
                        </Button>
                        <Link
                          to="/"
                          className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
                        >
                          Back to Home
                        </Link>
                      </div>

                      <Button
                        type="submit"
                        disabled={createCompanyMutation.isPending}
                        className="h-11 px-6 bg-slate-900 hover:bg-black text-white font-bold rounded-xl shadow-md transition-all active:scale-[0.99]"
                      >
                        {createCompanyMutation.isPending ? 'Registering Company...' : 'Create & Continue →'}
                      </Button>
                    </div>
                  </form>
                )}

                {/* Sub-form: Join Company */}
                {companyOption === 'join' && (
                  <div className="flex flex-col gap-4 mt-6">
                    <TextField
                      label="Search Registered Companies"
                      placeholder="Type company name (min 2 characters)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />

                    {searchCompaniesQuery.isLoading ? (
                      <div className="text-center py-6 text-slate-500 text-sm">Searching registered entities...</div>
                    ) : searchCompaniesQuery.data?.companies?.length ? (
                      <div className="flex flex-col gap-2 mt-2">
                        {searchCompaniesQuery.data.companies.map((c: any) => (
                          <div
                            key={c._id}
                            className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition-all"
                          >
                            <div>
                              <strong className="text-slate-900">{c.name}</strong>
                              <small className="block text-slate-500">
                                {c.website || 'No Website'} &middot; {c.industry || 'No Industry specified'}
                              </small>
                            </div>
                            <Button
                              variant="quiet"
                              disabled={joinCompanyMutation.isPending}
                              onClick={() => joinCompanyMutation.mutate(c._id)}
                              className="text-xs font-bold text-emerald-700 hover:bg-emerald-50"
                            >
                              Send Join Request
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : searchQuery.length >= 2 ? (
                      <div className="text-center py-6 text-slate-500 text-sm">No companies match this query. Try a different name or create a new company.</div>
                    ) : null}

                    <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-4">
                      <div className="flex items-center gap-2">
                        <Button variant="quiet" onClick={() => setStep(1)}>
                          &larr; Back to Personal
                        </Button>
                        <Link
                          to="/"
                          className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
                        >
                          Back to Home
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================= STEP 3: REVIEW & SUBMIT ================= */}
        {step === 3 && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xl shadow-slate-100 p-6 sm:p-8">
            <div className="border-b border-slate-100 pb-4 mb-6">
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Step 3 of 3</span>
              <h2 className="text-xl font-bold text-slate-900 mt-0.5">Review &amp; Submit for Verification</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Please inspect your details. Once submitted, your profile and company entity are placed in the administrative queue for legitimacy review.
              </p>
            </div>

            <div className="flex flex-col gap-6">
              {/* Personal Details Summary */}
              <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <h3 className="font-bold text-slate-900 text-base">Personal Details</h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 transition-colors cursor-pointer"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    <span>Edit Personal</span>
                  </button>
                </div>

                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-slate-500 font-medium">Name</dt>
                    <dd className="font-semibold text-slate-900 mt-0.5">{fullName || user?.fullName || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500 font-medium">Job Title</dt>
                    <dd className="font-semibold text-slate-900 mt-0.5">{designation || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500 font-medium">Phone</dt>
                    <dd className="font-semibold text-slate-900 mt-0.5">{phone || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500 font-medium">LinkedIn</dt>
                    <dd className="font-semibold text-slate-900 mt-0.5 truncate">
                      {linkedinUrl ? (
                        <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline">
                          {linkedinUrl}
                        </a>
                      ) : (
                        '—'
                      )}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Company Details Summary */}
              <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <h3 className="font-bold text-slate-900 text-base">Company Entity Details</h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 transition-colors cursor-pointer"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    <span>Edit Company</span>
                  </button>
                </div>

                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-slate-500 font-medium">Company Brand Name</dt>
                    <dd className="font-bold text-slate-900 mt-0.5">{associatedCompany?.name || companyName || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500 font-medium">Legal Entity Name</dt>
                    <dd className="font-semibold text-slate-900 mt-0.5">{associatedCompany?.legalName || legalName || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500 font-medium">Entity Type</dt>
                    <dd className="font-semibold text-slate-900 mt-0.5 capitalize">
                      {(associatedCompany?.entityType || entityType || '').replace('_', ' ')}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500 font-medium">CIN / LLPIN</dt>
                    <dd className="font-mono font-semibold text-slate-900 mt-0.5">{associatedCompany?.cin || cin || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500 font-medium">GSTIN</dt>
                    <dd className="font-mono font-semibold text-slate-900 mt-0.5">{associatedCompany?.gstin || gstin || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500 font-medium">Website</dt>
                    <dd className="font-semibold text-slate-900 mt-0.5 truncate">
                      {associatedCompany?.website || website ? (
                        <a href={associatedCompany?.website || website} target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline">
                          {associatedCompany?.website || website}
                        </a>
                      ) : (
                        '—'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500 font-medium">Industry</dt>
                    <dd className="font-semibold text-slate-900 mt-0.5">{associatedCompany?.industry || industry || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500 font-medium">Registered State / City</dt>
                    <dd className="font-semibold text-slate-900 mt-0.5">
                      {associatedCompany?.registeredAddress?.state || state || city || '—'}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Security & Verification Callout */}
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/90 text-emerald-950 text-xs sm:text-sm flex items-start gap-3">
                <svg className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <div>
                  <strong className="block text-emerald-900 font-bold mb-0.5">Administrative Review Workflow</strong>
                  <span>
                    Upon clicking submit, your identity and corporate credentials will be dispatched to the system administrator queue for legitimacy checks. You can check your review status anytime or return to the homepage.
                  </span>
                </div>
              </div>

              {/* Step 3 Actions & Navigation */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-slate-100 mt-2">
                <div className="flex items-center gap-2">
                  <Button variant="quiet" onClick={() => setStep(2)}>
                    &larr; Back to Company
                  </Button>
                  <Link
                    to="/"
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"
                  >
                    <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    <span>Back to Home</span>
                  </Link>
                </div>

                <Button
                  onClick={() => submitVerificationMutation.mutate()}
                  disabled={submitVerificationMutation.isPending || (!associatedCompany && !companyName)}
                  className="h-11 px-7 bg-slate-900 hover:bg-black text-white font-bold rounded-xl shadow-md transition-all active:scale-[0.99]"
                >
                  {submitVerificationMutation.isPending ? 'Submitting Verification...' : 'Submit for Verification 🚀'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-6 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">Talvix</span>
            <span>&copy; {new Date().getFullYear()} Talvix Inc. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/" className="hover:text-slate-900 transition-colors">Home</Link>
            <Link to="/recruiter/verification-status" className="hover:text-slate-900 transition-colors">Verification Status</Link>
            <a href="mailto:support@talvix.com" className="hover:text-slate-900 transition-colors">Contact Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
