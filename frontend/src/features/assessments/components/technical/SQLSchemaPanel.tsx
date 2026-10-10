import React, { useState } from 'react';
import { Database, Table, Key } from 'lucide-react';

export interface SQLTable {
  tableName: string;
  columns: { name: string; type: string; isPrimaryKey?: boolean; isForeignKey?: boolean }[];
  sampleRows?: Record<string, unknown>[];
}

interface Props {
  tables: SQLTable[];
  isLoading?: boolean;
}

export const SQLSchemaPanel: React.FC<Props> = ({ tables, isLoading }) => {
  const [activeTable, setActiveTable] = useState<string>(tables[0]?.tableName || '');

  if (isLoading) {
    return (
      <div className="p-4 bg-slate-900 text-slate-400 rounded-lg border border-slate-800 text-xs flex items-center justify-center gap-2">
        <span className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        <span>Loading database schema...</span>
      </div>
    );
  }

  if (!tables || tables.length === 0) {
    return (
      <div className="p-4 bg-slate-900 text-slate-400 rounded-lg border border-slate-800 text-xs flex items-center gap-2">
        <Database className="w-4 h-4 text-slate-500" />
        <span>No database tables configured for this SQL question.</span>
      </div>
    );
  }

  const selected = tables.find((t) => t.tableName === (activeTable || tables[0].tableName)) || tables[0];

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-3 text-xs font-mono space-y-3">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-slate-200 font-semibold">
        <Database className="w-4 h-4 text-blue-400" />
        <span>Database Schema Viewer</span>
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-slate-800/80 pb-2">
        {tables.map((tbl) => (
          <button
            key={tbl.tableName}
            onClick={() => setActiveTable(tbl.tableName)}
            className={`px-3 py-1 rounded text-xs flex items-center gap-1.5 transition-colors ${
              selected.tableName === tbl.tableName
                ? 'bg-blue-600/30 border border-blue-500/50 text-blue-300 font-medium'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>{tbl.tableName}</span>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <div className="text-slate-400 font-medium">Columns in <span className="text-blue-300">{selected.tableName}</span>:</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {selected.columns.map((col) => (
            <div
              key={col.name}
              className="p-2 rounded bg-slate-950/60 border border-slate-800/70 flex items-center justify-between"
            >
              <div className="flex items-center gap-1.5">
                {col.isPrimaryKey && <Key className="w-3 h-3 text-amber-400" title="Primary Key" />}
                <span className="text-slate-200 font-medium">{col.name}</span>
              </div>
              <span className="text-slate-400 text-[11px] uppercase tracking-wider">{col.type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
