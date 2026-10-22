import React, { useState } from 'react';
import { FileText, RefreshCw, AlertTriangle, CheckCircle2, Check, Sparkles, Layers, Clock, Award, ArrowRight } from 'lucide-react';
import { Alert, Button, StatusTag } from '../../design-system';
import {
  useJobBlueprint,
  useGenerateJobBlueprint,
  useRegenerateBlueprintSection,
  useApproveJobBlueprint,
  useConvertBlueprintToAssessment
} from './api';

interface JobBlueprintCardProps {
  jobId?: string;
  title?: string;
  description?: string;
  initialBlueprint?: any;
}

export function JobBlueprintCard({ jobId, title = '', description = '', initialBlueprint }: JobBlueprintCardProps) {
  const isRealId = Boolean(jobId && jobId !== 'new' && /^[0-9a-fA-F]{24}$/.test(jobId));
  const { data: fetchedBlueprint, isLoading } = useJobBlueprint(jobId || '', isRealId);
  const generateMutation = useGenerateJobBlueprint(jobId);
  const regenerateSectionMutation = useRegenerateBlueprintSection(isRealId ? (jobId || '') : '');
  const approveMutation = useApproveJobBlueprint(isRealId ? (jobId || '') : '');
  const convertMutation = useConvertBlueprintToAssessment(isRealId ? (jobId || '') : '');

  const [activeRegenSection, setActiveRegenSection] = useState<string | null>(null);
  const [sectionInstructions, setSectionInstructions] = useState<string>('');
  const [convertSuccessMsg, setConvertSuccessMsg] = useState<string | null>(null);

  const resData = generateMutation.data as any;
  const rawMutatedBlueprint = resData?.blueprint || resData?.data?.blueprint || (resData && !resData.data ? resData : null);
  const blueprintWrapper = fetchedBlueprint || initialBlueprint;
  const blueprintObj = blueprintWrapper?.blueprint || blueprintWrapper;
  const status = blueprintObj?.status || (rawMutatedBlueprint ? 'proposed' : 'none');
  const data = blueprintObj?.data || (rawMutatedBlueprint?.data ? rawMutatedBlueprint.data : rawMutatedBlueprint);

  const handleGenerate = () => {
    generateMutation.mutate({ forceRefresh: true, title, description });
  };

  const handleRegenerateSection = (sectionId: string) => {
    if (!jobId) return;
    regenerateSectionMutation.mutate(
      { sectionId, customInstructions: sectionInstructions },
      {
        onSuccess: () => {
          setActiveRegenSection(null);
          setSectionInstructions('');
        }
      }
    );
  };

  const handleApprove = () => {
    if (!jobId) return;
    approveMutation.mutate();
  };

  const handleConvert = () => {
    if (!jobId) return;
    convertMutation.mutate(undefined, {
      onSuccess: (res: any) => {
        const assessmentId = res?.data?.assessmentId;
        setConvertSuccessMsg(`Assessment blueprint successfully created! ID: ${assessmentId || 'Created'}`);
      }
    });
  };

  const getStatusTag = () => {
    switch (status) {
      case 'approved':
        return <StatusTag tone="success">Approved by Recruiter</StatusTag>;
      case 'converted':
        return <StatusTag tone="success">Converted to Assessment</StatusTag>;
      case 'proposed':
        return <StatusTag tone="info">Ready for Review</StatusTag>;
      case 'stale':
        return <StatusTag tone="warning">Stale (Job edited)</StatusTag>;
      case 'pending':
        return <StatusTag tone="info">Generating...</StatusTag>;
      case 'failed':
        return <StatusTag tone="danger">Generation Failed</StatusTag>;
      default:
        return <StatusTag tone="neutral">No Blueprint</StatusTag>;
    }
  };

  return (
    <div className="p-6 border border-slate-200 shadow-xs rounded-xl bg-white mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-slate-900">AI Assessment Blueprint</h3>
              {getStatusTag()}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Structured evaluation blueprint mapping job skills to candidate assessment tasks.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="compact"
          onClick={handleGenerate}
          disabled={generateMutation.isPending || (!jobId && (!title.trim() || !description.trim()))}
          className="flex items-center gap-2 self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${generateMutation.isPending ? 'animate-spin' : ''}`} />
          {generateMutation.isPending ? 'Generating...' : data ? 'Regenerate Blueprint' : 'Generate Blueprint'}
        </Button>
      </div>

      {status === 'stale' && (
        <Alert tone="warning" title="Blueprint Outdated" className="my-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" />
            <div>
              <p className="text-xs text-amber-700 mt-0.5">
                The job description was modified after blueprint generation. Click 'Regenerate Blueprint' to update alignment.
              </p>
            </div>
          </div>
        </Alert>
      )}

      {convertSuccessMsg && (
        <Alert tone="success" title="Converted Successfully" className="my-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <p className="text-sm text-emerald-900">{convertSuccessMsg}</p>
          </div>
        </Alert>
      )}

      {data && (
        <div className="mt-6 space-y-6">
          {/* Blueprint Overview Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-indigo-500 shrink-0" />
              <div>
                <p className="text-xs font-medium text-slate-500">Duration</p>
                <p className="text-sm font-bold text-slate-900">{data.totalDurationMinutes || 60} mins</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Award className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <p className="text-xs font-medium text-slate-500">Total Marks</p>
                <p className="text-sm font-bold text-slate-900">{data.totalMarks || 100} pts</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-purple-500 shrink-0" />
              <div>
                <p className="text-xs font-medium text-slate-500">Target Seniority</p>
                <p className="text-sm font-bold text-slate-900 capitalize">{data.targetSeniority || 'Standard'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <div>
                <p className="text-xs font-medium text-slate-500">Passing Cutoff</p>
                <p className="text-sm font-bold text-slate-900">{data.recommendedPassingPercentage || 70}%</p>
              </div>
            </div>
          </div>

          {/* Assessment Sections */}
          <div>
            <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              Proposed Assessment Sections ({data.sections?.length || 0})
            </h4>

            <div className="space-y-3">
              {data.sections?.map((section: any, idx: number) => (
                <div key={section.id || idx} className="p-4 border border-slate-200 rounded-lg bg-white hover:border-slate-300 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 flex items-center justify-center bg-indigo-100 text-indigo-700 font-semibold text-xs rounded-full">
                        {idx + 1}
                      </span>
                      <h5 className="text-sm font-semibold text-slate-900">{section.title}</h5>
                      <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-medium capitalize">
                        {section.questionType}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>{section.questionCount} questions</span>
                      <span>•</span>
                      <span>{section.durationMinutes} mins</span>
                      <span>•</span>
                      <span className="font-medium text-slate-700">{section.sectionMarks} pts</span>
                    </div>
                  </div>

                  {section.purpose && (
                    <p className="text-xs text-slate-600 mb-2">{section.purpose}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-xs font-medium text-slate-400 mr-1">Evaluates:</span>
                    {section.skillsEvaluated?.map((skill: string, sIdx: number) => (
                      <span key={sIdx} className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md font-medium">
                        {skill}
                      </span>
                    ))}
                  </div>

                  {/* Section AI Regeneration Panel */}
                  {jobId && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                      {activeRegenSection === section.id ? (
                        <div className="w-full flex flex-col gap-2">
                          <input
                            type="text"
                            placeholder="Feedback or custom instructions for this section..."
                            value={sectionInstructions}
                            onChange={(e) => setSectionInstructions(e.target.value)}
                            className="text-xs px-3 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <div className="flex items-center gap-2 justify-end">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => setActiveRegenSection(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              onClick={() => handleRegenerateSection(section.id)}
                              disabled={regenerateSectionMutation.isPending}
                            >
                              {regenerateSectionMutation.isPending ? 'Regenerating...' : 'Regenerate Section'}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveRegenSection(section.id);
                            setSectionInstructions('');
                          }}
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Regenerate section with AI
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Recruiter Action Toolbar */}
          {jobId && (
            <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {status !== 'approved' && status !== 'converted' && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleApprove}
                    disabled={approveMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    <Check className="w-4 h-4 text-emerald-600" />
                    {approveMutation.isPending ? 'Approving...' : 'Approve Blueprint'}
                  </Button>
                )}

                {(status === 'approved' || status === 'proposed') && (
                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleConvert}
                    disabled={convertMutation.isPending}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700"
                  >
                    <ArrowRight className="w-4 h-4" />
                    {convertMutation.isPending ? 'Converting...' : 'Convert to Official Assessment'}
                  </Button>
                )}
              </div>

              <p className="text-xs text-slate-500">
                Non-destructive draft creation. Recruiter review required before publishing.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
