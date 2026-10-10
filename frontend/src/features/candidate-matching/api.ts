import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../api/client';

export interface SkillGapItem {
  canonicalSkill: string;
  displayName: string;
  requirementType: 'required' | 'preferred';
  jobRequirement: {
    minimumProficiency: string;
    minimumYearsOfExperience: number;
  };
  candidateEvidence: {
    found: boolean;
    proficiency: string;
    yearsOfExperience: number;
    source: string;
  };
  evidenceClassification: 'demonstrated' | 'partially_demonstrated' | 'not_found' | 'not_assessed';
  confidenceStatus: 'verified' | 'unverified' | 'assessed' | 'inferred';
  assessmentResult: { score: number; passed: boolean } | null;
  suggestedNextStep: string;
}

export interface CandidateMatchResult {
  overallScore: number;
  requiredSkillCoverage: {
    percentage: number;
    matchedCount: number;
    totalCount: number;
  };
  preferredSkillCoverage: {
    percentage: number;
    matchedCount: number;
    totalCount: number;
  };
  relevantExperienceEvidence: {
    candidateYears: number;
    requiredYears: number;
    matchesRequirement: boolean;
  };
  qualificationAlignment: {
    matches: boolean;
    details: string;
  };
  assessmentEvidence: {
    completedCount: number;
    averageScore: number;
    allPassed: boolean;
  } | null;
  matchStrengths: string[];
  potentialSkillGaps: string[];
  missingInformation: string[];
  skillGapAnalysis: SkillGapItem[];
  scoringVersion: number;
}

export function useApplicantMatches(jobId: string, options: { page?: number; limit?: number; sort?: string } = {}, enabled = true) {
  const queryParams = new URLSearchParams({
    page: String(options.page || 1),
    limit: String(options.limit || 10),
    sort: options.sort || 'score-desc'
  }).toString();

  return useQuery({
    queryKey: ['applicant-matches', jobId, queryParams],
    enabled: Boolean(jobId) && enabled,
    queryFn: () => apiRequest<{ data: { jobId: string; matches: any[]; pagination: any } }>(`/applications/manage/jobs/${jobId}/matches?${queryParams}`),
    select: (res) => res?.data,
    retry: false
  });
}

export function useApplicationMatchDetails(applicationId: string, enabled = true) {
  return useQuery({
    queryKey: ['application-match-details', applicationId],
    enabled: Boolean(applicationId) && enabled,
    queryFn: () => apiRequest<{ data: { match: CandidateMatchResult; explanation: string; candidate: any } }>(`/applications/manage/${applicationId}/match-details`),
    select: (res) => res?.data,
    retry: false
  });
}

export function useCandidateJobFit(jobId: string, enabled = true) {
  return useQuery({
    queryKey: ['candidate-job-fit', jobId],
    enabled: Boolean(jobId) && enabled,
    queryFn: () => apiRequest<{ data: { jobId: string; jobTitle: string; matchScore: number; requiredSkillCoverage: any; preferredSkillCoverage: any; skillGapAnalysis: SkillGapItem[]; matchStrengths: string[]; potentialSkillGaps: string[] } }>(`/applications/me/jobs/${jobId}/fit-analysis`),
    select: (res) => res?.data,
    retry: false
  });
}

export function useCalculateCandidateMatch(jobId: string, candidateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest<{ data: { match: CandidateMatchResult; explanation: string } }>(`/applications/manage/jobs/${jobId}/candidates/${candidateId}/match`, {
      method: 'POST'
    }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['applicant-matches', jobId] });
    }
  });
}
