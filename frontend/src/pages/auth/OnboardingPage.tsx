import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { homeForRole, useAuth } from '../../auth/AuthProvider';
import { apiRequest } from '../../api/client';
import { useToast } from '../../design-system';

export default function OnboardingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { completeAuth } = useAuth();

  const state = location.state as {
    onboardingSessionId?: string;
    email?: string;
    fullName?: string;
    provider?: 'google' | 'github';
  } | null;

  const [step, setStep] = useState(1);
  const [role, setRole] = useState<'candidate' | 'recruiter' | null>(null);

  // Candidate Data State
  const [candidateData, setCandidateData] = useState({
    college: '',
    degree: '',
    skillsInput: '',
  });

  // Recruiter Data State
  const [recruiterData, setRecruiterData] = useState({
    companyName: '',
    companyEmail: state?.email || '',
    companyWebsite: '',
    designation: '',
  });

  const [loading, setLoading] = useState(false);

  if (!state?.onboardingSessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/50 p-4">
        <div className="w-full max-w-md bg-white border border-slate-200 shadow-xl rounded-2xl p-8 text-center">
          <svg className="w-16 h-16 text-rose-500 mx-auto mb-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Invalid Session</h2>
          <p className="text-slate-500 text-sm mb-6">
            The onboarding session has expired or is invalid. Please sign in with Google again.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold text-sm transition-all active:scale-[0.98]"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  const handleNextStep = () => {
    if (step === 1 && !role) {
      toast.push({
        title: 'Selection Required',
        message: 'Please choose an account type to proceed.',
        tone: 'warning',
      });
      return;
    }
    setStep(2);
  };

  const handleBackStep = () => {
    setStep(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let onboardingData = {};
      if (role === 'candidate') {
        if (!candidateData.college.trim() || !candidateData.degree.trim()) {
          toast.push({
            title: 'Incomplete Fields',
            message: 'Please fill out your College and Degree details.',
            tone: 'warning',
          });
          setLoading(false);
          return;
        }
        onboardingData = {
          college: candidateData.college.trim(),
          degree: candidateData.degree.trim(),
          skills: candidateData.skillsInput
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0),
        };
      } else if (role === 'recruiter') {
        if (
          !recruiterData.companyName.trim() ||
          !recruiterData.companyEmail.trim() ||
          !recruiterData.designation.trim()
        ) {
          toast.push({
            title: 'Incomplete Fields',
            message: 'Please fill out all required company information.',
            tone: 'warning',
          });
          setLoading(false);
          return;
        }
        onboardingData = {
          companyName: recruiterData.companyName.trim(),
          companyEmail: recruiterData.companyEmail.trim(),
          companyWebsite: recruiterData.companyWebsite.trim() || undefined,
          designation: recruiterData.designation.trim(),
        };
      }

      const endpoint = state?.provider === 'github' ? '/auth/github/complete' : '/auth/google/complete';
      const response = await apiRequest<{
        user: any;
        accessToken: string;
      }>(endpoint, {
        method: 'POST',
        body: {
          onboardingSessionId: state.onboardingSessionId,
          role,
          onboardingData,
        },
        auth: false,
      });

      await completeAuth({
        user: response.user,
        accessToken: response.accessToken,
      });

      toast.push({
        title: 'Onboarding Complete',
        message: 'Successfully set up your Talvix account.',
        tone: 'success',
      });

      navigate(homeForRole(response.user.role));
    } catch (error: any) {
      toast.push({
        title: 'Onboarding Failed',
        message: error?.message || 'Failed to complete onboarding.',
        tone: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center bg-slate-50/50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="w-full max-w-xl mx-auto bg-white border border-slate-200/80 shadow-2xl rounded-3xl p-8 sm:p-10 relative overflow-hidden transition-all duration-300">
        
        {/* Progress header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Step {step} of 2
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
              {step === 1 ? 'Choose Account Type' : 'Configure Profile'}
            </h1>
          </div>
          <div className="flex gap-1.5">
            <span className={`w-6 h-1.5 rounded-full transition-all duration-300 ${step >= 1 ? 'bg-slate-900' : 'bg-slate-200'}`} />
            <span className={`w-6 h-1.5 rounded-full transition-all duration-300 ${step >= 2 ? 'bg-slate-900' : 'bg-slate-200'}`} />
          </div>
        </div>

        {step === 1 ? (
          <div className="flex flex-col gap-6">
            <p className="text-slate-500 text-sm">
              Welcome, <strong className="text-slate-800 font-semibold">{state.fullName}</strong>. To configure your personalized workspace, please select your primary account type.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              {/* Candidate Selection */}
              <button
                type="button"
                onClick={() => setRole('candidate')}
                className={`flex flex-col gap-4 text-left p-6 border-2 rounded-2xl transition-all duration-200 shadow-sm hover:shadow active:scale-[0.99] focus:outline-none ${
                  role === 'candidate'
                    ? 'border-slate-900 bg-slate-50/50'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${role === 'candidate' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.263 15.541A17.49 17.49 0 0012 17.25c2.785 0 5.42-.652 7.737-1.81L12 11.25l-7.737 4.291zM21 7.5v7.5m-9-9h.008v.008H12V6z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 11.25V21M3 7.5L12 3l9 4.5M3 7.5L12 12l9-4.5" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Candidate</h3>
                  <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                    Search jobs, showcase your skills, and get discovered by recruiters.
                  </p>
                </div>
              </button>

              {/* Recruiter Selection */}
              <button
                type="button"
                onClick={() => setRole('recruiter')}
                className={`flex flex-col gap-4 text-left p-6 border-2 rounded-2xl transition-all duration-200 shadow-sm hover:shadow active:scale-[0.99] focus:outline-none ${
                  role === 'recruiter'
                    ? 'border-slate-900 bg-slate-50/50'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${role === 'recruiter' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h18v18H3V3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Recruiter / Employer</h3>
                  <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                    Publish job listings, manage applications, and conduct assessments.
                  </p>
                </div>
              </button>
            </div>

            <button
              onClick={handleNextStep}
              className="mt-6 w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold text-sm transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-2"
            >
              <span>Continue</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {role === 'candidate' ? (
              <div className="flex flex-col gap-4">
                {/* College */}
                <div>
                  <label htmlFor="college" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    College / University *
                  </label>
                  <input
                    id="college"
                    type="text"
                    required
                    value={candidateData.college}
                    onChange={(e) => setCandidateData({ ...candidateData, college: e.target.value })}
                    placeholder="e.g. Stanford University"
                    className="w-full py-2.5 px-4 border border-slate-200 hover:border-slate-300 focus:border-slate-900 rounded-xl font-medium text-slate-800 placeholder-slate-400 text-sm transition-all outline-none bg-slate-50/20"
                  />
                </div>

                {/* Degree */}
                <div>
                  <label htmlFor="degree" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Degree / Course *
                  </label>
                  <input
                    id="degree"
                    type="text"
                    required
                    value={candidateData.degree}
                    onChange={(e) => setCandidateData({ ...candidateData, degree: e.target.value })}
                    placeholder="e.g. Bachelor of Science in Computer Science"
                    className="w-full py-2.5 px-4 border border-slate-200 hover:border-slate-300 focus:border-slate-900 rounded-xl font-medium text-slate-800 placeholder-slate-400 text-sm transition-all outline-none bg-slate-50/20"
                  />
                </div>

                {/* Skills */}
                <div>
                  <label htmlFor="skills" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Skills (Comma separated)
                  </label>
                  <input
                    id="skills"
                    type="text"
                    value={candidateData.skillsInput}
                    onChange={(e) => setCandidateData({ ...candidateData, skillsInput: e.target.value })}
                    placeholder="e.g. React, Node.js, TypeScript"
                    className="w-full py-2.5 px-4 border border-slate-200 hover:border-slate-300 focus:border-slate-900 rounded-xl font-medium text-slate-800 placeholder-slate-400 text-sm transition-all outline-none bg-slate-50/20"
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Company Name */}
                <div>
                  <label htmlFor="companyName" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Company Name *
                  </label>
                  <input
                    id="companyName"
                    type="text"
                    required
                    value={recruiterData.companyName}
                    onChange={(e) => setRecruiterData({ ...recruiterData, companyName: e.target.value })}
                    placeholder="e.g. Acme Corp"
                    className="w-full py-2.5 px-4 border border-slate-200 hover:border-slate-300 focus:border-slate-900 rounded-xl font-medium text-slate-800 placeholder-slate-400 text-sm transition-all outline-none bg-slate-50/20"
                  />
                </div>

                {/* Company Email */}
                <div>
                  <label htmlFor="companyEmail" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Company Contact Email *
                  </label>
                  <input
                    id="companyEmail"
                    type="email"
                    required
                    value={recruiterData.companyEmail}
                    onChange={(e) => setRecruiterData({ ...recruiterData, companyEmail: e.target.value })}
                    placeholder="e.g. recruitment@acme.com"
                    className="w-full py-2.5 px-4 border border-slate-200 hover:border-slate-300 focus:border-slate-900 rounded-xl font-medium text-slate-800 placeholder-slate-400 text-sm transition-all outline-none bg-slate-50/20"
                  />
                </div>

                {/* Company Website */}
                <div>
                  <label htmlFor="companyWebsite" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Company Website (Optional)
                  </label>
                  <input
                    id="companyWebsite"
                    type="text"
                    value={recruiterData.companyWebsite}
                    onChange={(e) => setRecruiterData({ ...recruiterData, companyWebsite: e.target.value })}
                    placeholder="e.g. https://acme.com"
                    className="w-full py-2.5 px-4 border border-slate-200 hover:border-slate-300 focus:border-slate-900 rounded-xl font-medium text-slate-800 placeholder-slate-400 text-sm transition-all outline-none bg-slate-50/20"
                  />
                </div>

                {/* Designation */}
                <div>
                  <label htmlFor="designation" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Your Designation *
                  </label>
                  <input
                    id="designation"
                    type="text"
                    required
                    value={recruiterData.designation}
                    onChange={(e) => setRecruiterData({ ...recruiterData, designation: e.target.value })}
                    placeholder="e.g. Lead Talent Acquisition Partner"
                    className="w-full py-2.5 px-4 border border-slate-200 hover:border-slate-300 focus:border-slate-900 rounded-xl font-medium text-slate-800 placeholder-slate-400 text-sm transition-all outline-none bg-slate-50/20"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={handleBackStep}
                className="w-1/3 py-3 border border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] focus:outline-none"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-2/3 py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-800/80 text-white rounded-xl font-semibold text-sm transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-2 focus:outline-none"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Complete Onboarding</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
