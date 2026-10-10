import React from 'react';
import { Target, CheckCircle2, AlertCircle, BookOpen, Sparkles, ShieldCheck } from 'lucide-react';
import { Card, StatusTag } from '../../design-system';
import { useCandidateJobFit } from './api';

interface CandidateJobFitCardProps {
  jobId: string;
}

export function CandidateJobFitCard({ jobId }: CandidateJobFitCardProps) {
  const { data, isLoading, isError } = useCandidateJobFit(jobId);

  if (isLoading) {
    return <div className="p-4 text-xs text-slate-500 animate-pulse">Calculating role fit analysis...</div>;
  }

  if (isError || !data) {
    return null;
  }

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500 text-white';
    if (score >= 60) return 'bg-amber-500 text-white';
    return 'bg-slate-600 text-white';
  };

  return (
    <Card className="p-6 border border-slate-200 shadow-sm rounded-xl bg-white mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-50 text-purple-600 rounded-lg">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-slate-900">Your Role Fit & Skill Breakdown</h3>
              <StatusTag status="verified" label="Objective Analysis" />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Personalized skill alignment and self-development guidance based on your profile & parsed resume.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <div className={`px-3 py-1.5 rounded-full font-bold text-sm ${getScoreBadgeColor(data.matchScore)}`}>
            {data.matchScore}% Role Match
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {/* Coverage Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-700">Required Skills Met</span>
              <span className="text-xs font-bold text-slate-900">
                {data.requiredSkillCoverage?.matchedCount || 0} / {data.requiredSkillCoverage?.totalCount || 0} ({data.requiredSkillCoverage?.percentage || 0}%)
              </span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-indigo-600 h-full transition-all duration-300"
                style={{ width: `${data.requiredSkillCoverage?.percentage || 0}%` }}
              />
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-700">Preferred Skills Met</span>
              <span className="text-xs font-bold text-slate-900">
                {data.preferredSkillCoverage?.matchedCount || 0} / {data.preferredSkillCoverage?.totalCount || 0} ({data.preferredSkillCoverage?.percentage || 0}%)
              </span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-purple-600 h-full transition-all duration-300"
                style={{ width: `${data.preferredSkillCoverage?.percentage || 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Strengths */}
        {data.matchStrengths?.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Key Role Alignment Strengths
            </h4>
            <ul className="space-y-1.5 pl-6 list-disc text-xs text-slate-700">
              {data.matchStrengths.map((strength, idx) => (
                <li key={idx}>{strength}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Skill Gap Analysis & Practical Learning Recommendations */}
        {data.skillGapAnalysis?.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              Skill Gap & Recommended Learning Paths
            </h4>

            <div className="space-y-3">
              {data.skillGapAnalysis.map((item, idx) => (
                <div key={idx} className="p-3 border border-slate-200 rounded-lg bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{item.displayName}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${item.requirementType === 'required' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                        {item.requirementType}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${item.evidenceClassification === 'demonstrated' ? 'bg-emerald-100 text-emerald-800' : item.evidenceClassification === 'partially_demonstrated' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'}`}>
                        {item.evidenceClassification.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{item.suggestedNextStep}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
