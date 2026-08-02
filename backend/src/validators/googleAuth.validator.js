import { z } from 'zod';

export const googleAuthSchema = z.object({
  idToken: z.string().trim().min(1, 'Google ID Token is required'),
});

export const googleOnboardingSchema = z.object({
  onboardingSessionId: z.string().trim().min(1, 'Onboarding session ID is required'),
  role: z.enum(['candidate', 'recruiter'], { required_error: 'Role is required' }),
  onboardingData: z.object({
    college: z.string().trim().min(2, 'College name must be at least 2 characters').optional(),
    degree: z.string().trim().min(2, 'Degree must be at least 2 characters').optional(),
    skills: z.array(z.string().trim()).default([]).optional(),
    companyName: z.string().trim().min(2, 'Company name must be at least 2 characters').optional(),
    companyWebsite: z.string().trim().optional(),
    companyEmail: z.string().trim().email('Invalid company email address').optional(),
    designation: z.string().trim().min(2, 'Designation must be at least 2 characters').optional(),
  }),
}).refine(data => {
  if (data.role === 'candidate') {
    return !!data.onboardingData.college && !!data.onboardingData.degree;
  }
  if (data.role === 'recruiter') {
    return !!data.onboardingData.companyName && !!data.onboardingData.companyEmail && !!data.onboardingData.designation;
  }
  return false;
}, {
  message: 'Missing required profile fields for the selected role',
  path: ['onboardingData'],
});
