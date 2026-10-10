import React from 'react';
import { Sparkles, RefreshCw, AlertCircle, CheckCircle2, Clock, HelpCircle, Layers, Award, BookOpen } from 'lucide-react';
import { Alert, Button, Card, StatusTag } from '../../design-system';
import { useExtractJobIntelligence, useJobIntelligence } from './api';

interface JobIntelligenceCardProps {
  jobId?: string;
  title?: string;
  description?: string;
  initialIntelligence?: any;
}

export function JobIntelligenceCard({ jobId, title = '', description = '', initialIntelligence }: JobIntelligenceCardProps) {
  const isRealId = Boolean(jobId && jobId !== 'new' && /^[0-9a-fA-F]{24}$/.test(jobId));
  const { data: fetchedIntelligence, isLoading, isError, refetch } = useJobIntelligence(jobId || '', isRealId);
  const extractMutation = useExtractJobIntelligence(jobId);

  const resData = extractMutation.data as any;
  const rawMutatedData = resData?.intelligence || resData?.data?.intelligence || (resData && !resData.data ? resData : null);
  const intelligence = fetchedIntelligence || initialIntelligence;
  const status = intelligence?.status || (rawMutatedData ? 'completed' : 'none');
  const data = intelligence?.data || (rawMutatedData?.data ? rawMutatedData.data : rawMutatedData);

  const handleExtract = () => {
    extractMutation.mutate({ forceRefresh: true, title, description });
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'completed':
        return <StatusTag status="verified" label="Intelligence Active" />;
      case 'stale':
        return <StatusTag status="warning" label="Outdated (Job Edited)" />;
      case 'pending':
        return <StatusTag status="info" label="Extracting..." />;
      case 'failed':
        return <StatusTag status="rejected" label="Extraction Failed" />;
      default:
        return <StatusTag status="draft" label="Not Extracted" />;
    }
  };

  return (
    <Card className="p-6 border border-slate-200 shadow-sm rounded-xl bg-white mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-slate-900">AI Job Intelligence</h3>
              {getStatusBadge()}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Structured skill categorization, explicit vs inferred requirement breakdown & assessment recommendations.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleExtract}
          disabled={extractMutation.isPending || (!isRealId && !title.trim())}
          className="flex items-center gap-2 self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${extractMutation.isPending ? 'animate-spin' : ''}`} />
          {extractMutation.isPending ? 'Analyzing...' : status === 'completed' ? 'Refresh Intelligence' : 'Extract Intelligence'}
        </Button>
      </div>

      {/* Stale Warning Banner */}
      {status === 'stale' && (
        <Alert variant="warning" className="my-4">
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-900">Job Description Edited</p>
              <p className="text-xs text-amber-700 mt-0.5">
                The job content was updated after intelligence was extracted. Click 'Refresh Intelligence' to update skills and recommendations.
              </p>
            </div>
          </div>
        </Alert>
      )}

      {/* Error Alert */}
      {(extractMutation.isError || (status === 'failed' && intelligence?.error)) && (
        <Alert variant="error" className="my-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 text-red-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-900">Intelligence Extraction Error</p>
              <p className="text-xs text-red-700 mt-0.5">
                {extractMutation.error ? (
                  (extractMutation.error as any).details && Array.isArray((extractMutation.error as any).details)
                    ? (extractMutation.error as any).details.map((d: any) => `${d.field ? d.field + ': ' : ''}${d.message}`).join('; ')
                    : extractMutation.error.message || 'Validation failed. Please provide a valid Job Title and Description.'
                ) : intelligence?.error || 'Failed to analyze job intelligence. Please retry.'}
              </p>
            </div>
          </div>
        </Alert>
      )}

      {/* Loading State */}
      {(extractMutation.isPending || (isLoading && jobId)) && !data && (
        <div className="py-8 text-center">
          <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-700">Analyzing Job Description with AI...</p>
          <p className="text-xs text-slate-500 mt-1">Categorizing skills, seniority level, and assessment blueprints</p>
        </div>
      )}

      {/* Empty State */}
      {!data && !extractMutation.isPending && !isLoading && status !== 'failed' && (
        <div className="py-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200 my-4">
          <Sparkles className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-700">No Intelligence Generated Yet</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
            Click 'Extract Intelligence' to automatically map canonical skills, seniority levels, requirements, and assessment recommendations.
          </p>
        </div>
      )}

      {/* Display Extracted Intelligence Data */}
      {data && (
        <div className="mt-6 space-y-6">
          {/* Metadata Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
            <div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">Seniority Level</span>
              <span className="text-sm font-semibold text-slate-900 capitalize">{data.seniorityLevel || 'Unknown'}</span>
            </div>
            <div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">Experience Range</span>
              <span className="text-sm font-semibold text-slate-900">
                {data.minimumExperience ?? 0}{data.maximumExperience !== undefined && data.maximumExperience !== null ? ` - ${data.maximumExperience}` : '+'} years
              </span>
            </div>
            <div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">Required Skills</span>
              <span className="text-sm font-semibold text-indigo-600">{data.requiredSkills?.length || 0} skills</span>
            </div>
            <div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">Preferred Skills</span>
              <span className="text-sm font-semibold text-slate-700">{data.preferredSkills?.length || 0} skills</span>
            </div>
          </div>

          {/* Required Skills Section */}
          {Array.isArray(data.requiredSkills) && data.requiredSkills.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Required Technical & Domain Skills
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.requiredSkills.map((skill: any, idx: number) => (
                  <div key={idx} className="p-3 bg-white rounded-lg border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900 text-sm">{skill.name}</span>
                      <div className="flex items-center gap-1">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${
                          skill.importance === 'critical' ? 'bg-red-100 text-red-700' :
                          skill.importance === 'high' ? 'bg-amber-100 text-amber-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {skill.importance}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${
                          skill.source === 'explicit' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'
                        }`}>
                          {skill.source === 'explicit' ? 'Stated' : 'AI Inferred'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                      <span className="capitalize font-medium text-slate-600">Category: {skill.category || 'General'}</span>
                    </div>
                    {skill.evidence && (
                      <p className="text-[11px] text-slate-500 italic bg-slate-50 p-1.5 rounded border border-slate-100 mt-1">
                        "{skill.evidence}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preferred Skills Section */}
          {Array.isArray(data.preferredSkills) && data.preferredSkills.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-indigo-600" />
                Preferred / Nice-to-Have Skills
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.preferredSkills.map((skill: any, idx: number) => (
                  <div key={idx} className="p-3 bg-white rounded-lg border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">{skill.name}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${
                        skill.source === 'explicit' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {skill.source === 'explicit' ? 'Stated' : 'AI Inferred'}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 capitalize block">Category: {skill.category || 'General'}</span>
                    {skill.evidence && (
                      <p className="text-[11px] text-slate-500 italic bg-slate-50 p-1.5 rounded border border-slate-100 mt-1">
                        "{skill.evidence}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Assessment Recommendations */}
          {Array.isArray(data.assessmentRecommendations) && data.assessmentRecommendations.length > 0 && (
            <div className="p-4 bg-indigo-50/50 rounded-lg border border-indigo-100">
              <h4 className="text-xs font-semibold text-indigo-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                Recommended Assessment Blueprints
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.assessmentRecommendations.map((rec: any, idx: number) => (
                  <div key={idx} className="p-3 bg-white rounded-md border border-indigo-100 text-xs space-y-1 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">{rec.domain}</span>
                      <span className="text-[10px] font-medium bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded uppercase">
                        {rec.category}
                      </span>
                    </div>
                    {rec.reason && <p className="text-slate-600 text-[11px]">{rec.reason}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
