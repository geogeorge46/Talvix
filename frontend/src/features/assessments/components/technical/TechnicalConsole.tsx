import React from 'react';
import { Terminal, Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { CodeExecutionResult } from '../../services/technicalAssessmentApi';

interface Props {
  result: CodeExecutionResult | null;
  isExecuting?: boolean;
}

export const TechnicalConsole: React.FC<Props> = ({ result, isExecuting }) => {
  if (isExecuting) {
    return (
      <div className="p-4 bg-slate-900 text-slate-100 rounded-lg border border-slate-800 font-mono text-sm min-h-[140px] flex items-center justify-center gap-2">
        <span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        <span>Executing code in sandbox...</span>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="p-4 bg-slate-900 text-slate-400 rounded-lg border border-slate-800 font-mono text-xs min-h-[140px] flex items-center gap-2">
        <Terminal className="w-4 h-4 text-slate-500" />
        <span>Run your code to view console output and sample test results.</span>
      </div>
    );
  }

  if (result.status === 'unavailable') {
    return (
      <div className="p-4 bg-amber-950/40 border border-amber-800/50 rounded-lg text-amber-200 font-mono text-xs min-h-[140px]">
        <div className="flex items-center gap-2 font-semibold mb-2 text-amber-300">
          <Info className="w-4 h-4" />
          <span>Execution Service Status</span>
        </div>
        <p className="text-amber-200/90 leading-relaxed">
          {result.message || 'Code execution is not available in Phase 1 workspace preview.'}
        </p>
        <p className="mt-2 text-slate-400 text-[11px]">
          Your solution code is continuously saved and ready for evaluation upon final assessment submission.
        </p>
      </div>
    );
  }

  if (result.status === 'error' || result.status === 'compile_error') {
    return (
      <div className="p-4 bg-rose-950/40 border border-rose-800/50 rounded-lg text-rose-200 font-mono text-xs min-h-[140px]">
        <div className="flex items-center gap-2 font-semibold mb-2 text-rose-400">
          <XCircle className="w-4 h-4" />
          <span>{result.status === 'compile_error' ? 'Compilation Error' : 'Execution Failed'}</span>
        </div>
        <pre className="whitespace-pre-wrap overflow-x-auto text-rose-200">{result.message || 'An error occurred during code execution.'}</pre>
      </div>
    );
  }

  const allPassed = (result.passedTests ?? 0) === (result.totalTests ?? 0) && (result.totalTests ?? 0) > 0;

  return (
    <div className="p-4 bg-slate-900 text-slate-100 rounded-lg border border-slate-800 font-mono text-xs min-h-[140px] space-y-3">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          {allPassed ? (
            <>
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-emerald-400">Passed All Sample Tests</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="font-semibold text-amber-400">Tests Failed</span>
            </>
          )}
        </div>
        {result.passedTests !== undefined && result.totalTests !== undefined && (
          <span className="text-slate-400 font-medium">
            Passed: {result.passedTests} / {result.totalTests} tests
          </span>
        )}
      </div>

      {result.testResults && result.testResults.length > 0 ? (
        <div className="space-y-2">
          {result.testResults.map((tc, index) => (
            <div
              key={index}
              className={`p-2.5 rounded border ${
                tc.passed ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-200' : 'bg-rose-950/30 border-rose-800/40 text-rose-200'
              }`}
            >
              <div className="flex justify-between font-semibold">
                <span>Test Case #{index + 1}</span>
                <span>{tc.passed ? '✓ PASSED' : '✗ FAILED'}</span>
              </div>
              {tc.input !== undefined && (
                <div className="text-[11px] text-slate-300 mt-1 font-mono">
                  <strong className="text-slate-400">Input:</strong> {typeof tc.input === 'object' ? JSON.stringify(tc.input) : String(tc.input)}
                </div>
              )}
              {tc.expectedOutput !== undefined && (
                <div className="text-[11px] text-slate-300 mt-0.5 font-mono">
                  <strong className="text-slate-400">Expected:</strong> {typeof tc.expectedOutput === 'object' ? JSON.stringify(tc.expectedOutput) : String(tc.expectedOutput)}
                </div>
              )}
              {tc.actualOutput !== undefined && (
                <div className="text-[11px] mt-0.5 font-mono">
                  <strong className="text-slate-400">Actual Output:</strong>{' '}
                  <span className={tc.passed ? 'text-emerald-300' : 'text-rose-300 font-bold'}>
                    {typeof tc.actualOutput === 'object' ? JSON.stringify(tc.actualOutput) : String(tc.actualOutput)}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-slate-400">{result.message || 'Code executed with zero exit errors.'}</div>
      )}
    </div>
  );
};
