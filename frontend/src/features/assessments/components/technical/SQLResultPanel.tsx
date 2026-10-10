import React from 'react';
import { Table, CheckCircle, XCircle } from 'lucide-react';

interface Props {
  result: {
    status: string;
    columns: string[];
    rows: Record<string, unknown>[];
    rowCount: number;
    executionTimeMs: number;
    error: string | null;
  } | null;
  isExecuting?: boolean;
}

export const SQLResultPanel: React.FC<Props> = ({ result, isExecuting }) => {
  if (isExecuting) {
    return (
      <div className="p-4 bg-slate-900 text-slate-100 rounded-lg border border-slate-800 font-mono text-sm min-h-[140px] flex items-center justify-center gap-2">
        <span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        <span>Executing SQL query in sandbox...</span>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="p-4 bg-slate-900 text-slate-400 rounded-lg border border-slate-800 font-mono text-xs min-h-[140px] flex items-center gap-2">
        <Table className="w-4 h-4 text-slate-500" />
        <span>Run your SQL query to view result tables and performance metrics.</span>
      </div>
    );
  }

  if (result.status === 'error' || result.error) {
    return (
      <div className="p-4 bg-rose-950/40 border border-rose-800/50 rounded-lg text-rose-200 font-mono text-xs min-h-[140px]">
        <div className="flex items-center gap-2 font-semibold mb-2 text-rose-400">
          <XCircle className="w-4 h-4" />
          <span>SQL Execution Failed</span>
        </div>
        <pre className="whitespace-pre-wrap text-rose-200">{result.error}</pre>
      </div>
    );
  }

  return (
    <div className="p-4 bg-slate-900 text-slate-100 rounded-lg border border-slate-800 font-mono text-xs space-y-3">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-emerald-400">Query Executed Successfully</span>
        </div>
        <div className="text-slate-400 space-x-3 text-[11px]">
          <span>Rows: {result.rowCount}</span>
          <span>Time: {result.executionTimeMs}ms</span>
        </div>
      </div>

      {result.rows.length > 0 && result.columns.length > 0 ? (
        <div className="overflow-x-auto border border-slate-800 rounded">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-800/80 text-slate-300 border-b border-slate-700">
                {result.columns.map((col) => (
                  <th key={col} className="p-2 font-medium border-r last:border-r-0 border-slate-700">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, rIdx) => (
                <tr key={rIdx} className="border-b last:border-b-0 border-slate-800/60 hover:bg-slate-800/40">
                  {result.columns.map((col) => (
                    <td key={col} className="p-2 border-r last:border-r-0 border-slate-800/60 text-slate-200">
                      {String(row[col] ?? 'NULL')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-slate-400 text-xs py-2">Query returned zero rows.</div>
      )}
    </div>
  );
};
