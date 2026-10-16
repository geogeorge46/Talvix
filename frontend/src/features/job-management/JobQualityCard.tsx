import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, RefreshCw, CheckCircle2, AlertCircle, Eye, Info, Check, X } from 'lucide-react';
import { Alert, Button, Card, StatusTag } from '../../design-system';
import { useAnalyzeJobQuality, useJobQuality } from './api';

interface JobQualityCardProps {
  jobId?: string;
  title?: string;
  description?: string;
  initialQuality?: any;
  onApplyReplacement?: (evidence: string, replacement: string, recommendation?: string) => void;
}

export function JobQualityCard({ jobId, title = '', description = '', initialQuality, onApplyReplacement }: JobQualityCardProps) {
  const isRealId = Boolean(jobId && jobId !== 'new' && /^[0-9a-fA-F]{24}$/.test(jobId));
  const { data: fetchedQuality, isLoading, isError } = useJobQuality(jobId || '', isRealId);
  const analyzeMutation = useAnalyzeJobQuality(jobId);

  const [dismissedFindings, setDismissedFindings] = useState<Set<string>>(new Set());

  const resData = analyzeMutation.data as any;
  const rawMutatedQuality = resData?.quality || resData?.data?.quality || (resData && !resData.data ? resData : null);
  const quality = fetchedQuality || initialQuality;
  const status = quality?.status || (rawMutatedQuality ? 'completed' : 'none');
  const overallScore = quality?.overallScore ?? rawMutatedQuality?.overallScore ?? 0;
  const categoryScores = quality?.categoryScores || rawMutatedQuality?.categoryScores || {};
  const rawFindings = quality?.findings || rawMutatedQuality?.findings || [];
  const summary = quality?.summary || rawMutatedQuality?.summary || '';

  const activeFindings = rawFindings.filter((f: any) => !dismissedFindings.has(f.id));

  const handleAnalyze = () => {
    analyzeMutation.mutate({ forceRefresh: true, title, description });
  };

  const handleDismiss = (id: string) => {
    setDismissedFindings((prev) => new Set([...prev, id]));
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500 text-white';
    if (score >= 60) return 'bg-amber-500 text-white';
    return 'bg-red-500 text-white';
  };

  const getStatusTag = () => {
    switch (status) {
      case 'completed':
        return <StatusTag tone="success">Analysis Complete</StatusTag>;
      case 'stale':
        return <StatusTag tone="warning">Stale (Job Edited)</StatusTag>;
      case 'pending':
        return <StatusTag tone="info">Analyzing...</StatusTag>;
      case 'failed':
        return <StatusTag tone="danger">Analysis Failed</StatusTag>;
      default:
        return <StatusTag tone="neutral">Not Analyzed</StatusTag>;
    }
  };

  return (
    <Card className="p-6 border border-slate-200 shadow-sm rounded-xl bg-white mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-slate-900">AI Job Quality & Fairness Analyzer</h3>
              {getStatusTag()}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Readability, experience consistency, qualification relevance & bias detection auditor.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="compact"
          onClick={handleAnalyze}
          disabled={analyzeMutation.isPending || (!isRealId && !title.trim())}
          className="flex items-center gap-2 self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${analyzeMutation.isPending ? 'animate-spin' : ''}`} />
          {analyzeMutation.isPending ? 'Auditing...' : status === 'completed' ? 'Re-analyze Quality' : 'Analyze Job Quality'}
        </Button>
      </div>

      {/* Stale Warning Banner */}
      {status === 'stale' && (
        <Alert tone="warning" title="Job Description Modified">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" />
            <div>
              <p className="text-xs text-amber-700 mt-0.5">
                The job post text was modified after quality analysis. Click 'Re-analyze Quality' for an updated assessment.
              </p>
            </div>
          </div>
        </Alert>
      )}

      {/* Error Alert */}
      {(analyzeMutation.isError || (status === 'failed' && quality?.error)) && (
        <Alert tone="danger" title="Quality Analysis Error">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 text-red-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-900">Quality Analysis Error</p>
              <p className="text-xs text-red-700 mt-0.5">
                {analyzeMutation.error ? (
                  (analyzeMutation.error as any).details && Array.isArray((analyzeMutation.error as any).details)
                    ? (analyzeMutation.error as any).details.map((d: any) => `${d.field ? d.field + ': ' : ''}${d.message}`).join('; ')
                    : analyzeMutation.error.message || 'Validation failed. Please provide a valid Job Title and Description.'
                ) : quality?.error || 'Failed to analyze job quality. Please retry.'}
              </p>
            </div>
          </div>
        </Alert>
      )}

      {/* Loading State */}
      {(analyzeMutation.isPending || (isLoading && jobId)) && !quality?.overallScore && (
        <div className="py-8 text-center">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-700">Auditing Job Quality & Inclusion Metrics...</p>
          <p className="text-xs text-slate-500 mt-1">Checking readability, experience balance, and fairness wording</p>
        </div>
      )}

      {/* Empty State */}
      {status === 'none' && !analyzeMutation.isPending && !isLoading && (
        <div className="py-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200 my-4">
          <ShieldCheck className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-700">No Quality Audit Performed</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
            Click 'Analyze Job Quality' to run an automated audit of clarity, seniority consistency, and inclusive wording.
          </p>
        </div>
      )}

      {/* Quality Audit Results */}
      {status === 'completed' && (
        <div className="mt-6 space-y-6">
          {/* Header Score Card */}
          <div className="flex flex-col md:flex-row items-center gap-6 p-5 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex flex-col items-center justify-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl shadow-sm ${getScoreBadgeColor(overallScore)}`}>
                {overallScore}
              </div>
              <span className="text-xs font-semibold text-slate-600 mt-1 uppercase tracking-wider">Overall Score</span>
            </div>

            <div className="flex-1 space-y-2 text-center md:text-left">
              <h4 className="text-sm font-semibold text-slate-900">Job Quality Summary</h4>
              <p className="text-xs text-slate-600 leading-relaxed">{summary}</p>
            </div>
          </div>

          {/* Category Scores Breakdown Grid */}
          <div>
            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">Dimension Scores</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.entries(categoryScores).map(([key, score]: [string, any]) => (
                <div key={key} className="p-3 bg-white rounded-lg border border-slate-200 text-xs">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-slate-700 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                    <span className={`font-bold ${score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                      {score}/100
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Findings List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                Audit Findings & Human Review Recommendations ({activeFindings.length})
              </h4>
            </div>

            {activeFindings.length === 0 ? (
              <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                No critical or high severity findings detected! The job posting exhibits strong clarity and fairness.
              </div>
            ) : (
              <div className="space-y-3">
                {activeFindings.map((finding: any) => (
                  <div key={finding.id} className="p-4 bg-white rounded-xl border border-slate-200 text-xs space-y-2 shadow-2xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          finding.severity === 'critical' ? 'bg-red-100 text-red-800' :
                          finding.severity === 'high' ? 'bg-amber-100 text-amber-800' :
                          finding.severity === 'medium' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {finding.severity}
                        </span>
                        <span className="font-semibold text-slate-800 capitalize">{finding.category.replace(/([A-Z])/g, ' $1')}</span>
                        {finding.requiresHumanReview && (
                          <span className="bg-purple-100 text-purple-800 text-[10px] px-1.5 py-0.5 rounded font-medium">
                            Requires Human Review
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDismiss(finding.id)}
                        className="text-slate-400 hover:text-slate-600 p-1 rounded"
                        title="Dismiss finding"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-slate-700 font-medium">{finding.explanation}</p>
                    <p className="text-slate-600"><strong>Recommendation:</strong> {finding.recommendation}</p>

                    {finding.evidence && (
                      <div className="bg-slate-50 p-2 rounded border border-slate-100 italic text-slate-600 text-[11px]">
                        Quoted Evidence: "{finding.evidence}"
                      </div>
                    )}

                    {finding.proposedReplacement ? (
                      <div className="p-2.5 bg-indigo-50/60 rounded border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-2">
                        <div>
                          <span className="text-[10px] font-bold text-indigo-900 uppercase block mb-0.5">Suggested Replacement</span>
                          <span className="text-slate-800 font-medium">{finding.proposedReplacement}</span>
                        </div>

                        {onApplyReplacement && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="compact"
                            onClick={() => onApplyReplacement(finding.evidence || '', finding.proposedReplacement, finding.recommendation)}
                            className="flex items-center gap-1.5 text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-100 self-start sm:self-auto shrink-0"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Apply Suggestion
                          </Button>
                        )}
                      </div>
                    ) : (
                      onApplyReplacement && (
                        <div className="flex justify-end mt-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="compact"
                            onClick={() => onApplyReplacement(finding.evidence || '', '', finding.recommendation)}
                            className="flex items-center gap-1.5 text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-100 shrink-0"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Apply Suggestion
                          </Button>
                        </div>
                      )
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
