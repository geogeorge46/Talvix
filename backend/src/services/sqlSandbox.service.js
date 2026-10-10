import { AppError } from '../shared/errors/AppError.js';

let DatabaseSync;
try {
  const sqlite = await import('node:sqlite');
  DatabaseSync = sqlite.DatabaseSync;
} catch {
  DatabaseSync = null;
}

export const validateSQLQuerySafety = (query) => {
  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new AppError('SQL query is required', 400);
  }

  const trimmed = query.trim();
  const normalized = trimmed.toUpperCase();

  // Multi-statement check
  const statements = trimmed.split(';').filter((s) => s.trim().length > 0);
  if (statements.length > 1) {
    throw new AppError('Multiple SQL statements are not permitted', 400);
  }

  // Enforce SELECT / WITH read-only queries
  if (!normalized.startsWith('SELECT') && !normalized.startsWith('WITH')) {
    throw new AppError('Only read-only SELECT or WITH queries are allowed', 400);
  }

  // Forbidden DDL/DML mutation keywords
  const forbidden = [
    'INSERT',
    'UPDATE',
    'DELETE',
    'DROP',
    'ALTER',
    'CREATE',
    'TRUNCATE',
    'GRANT',
    'REVOKE',
    'EXEC',
    'EXECUTE',
    'ATTACH',
    'DETACH',
    'PRAGMA',
  ];

  for (const keyword of forbidden) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(trimmed)) {
      throw new AppError(`Forbidden SQL keyword detected: ${keyword}`, 400);
    }
  }
};

export const executeInSQLSandbox = async ({ schemaDDL, seedDataDML, query, timeoutMs = 2000 }) => {
  validateSQLQuerySafety(query);

  if (DatabaseSync) {
    try {
      const db = new DatabaseSync(':memory:');
      try {
        if (schemaDDL) db.exec(schemaDDL);
        if (seedDataDML) db.exec(seedDataDML);

        const startTime = performance.now();
        const statement = db.prepare(query);
        const rows = statement.all();
        const endTime = performance.now();

        return {
          status: 'success',
          rows,
          columns: rows.length > 0 ? Object.keys(rows[0]) : [],
          rowCount: rows.length,
          executionTimeMs: Math.round(endTime - startTime),
        };
      } finally {
        try { db.close(); } catch {}
      }
    } catch {
      // Fallback to pure JS relational executor if native sqlite fails
    }
  }

  return executePureJSSQLSandbox({ schemaDDL, seedDataDML, query });
};

// Pure JS Relational Engine Fallback
const executePureJSSQLSandbox = ({ schemaDDL = '', seedDataDML = '', query = '' }) => {
  const startTime = performance.now();
  const tables = {};

  try {
    // 1. Parse DDL
    const ddlStatements = schemaDDL.split(';').filter((s) => s.trim());
    for (const stmt of ddlStatements) {
      const match = /CREATE\s+TABLE\s+(\w+)\s*\(([^)]+)\)/i.exec(stmt.trim());
      if (match) {
        const tableName = match[1].toLowerCase();
        const colDefs = match[2].split(',').map((c) => {
          const parts = c.trim().split(/\s+/);
          return parts[0].toLowerCase();
        });
        tables[tableName] = { columns: colDefs, rows: [] };
      }
    }

    // 2. Parse DML
    const dmlStatements = seedDataDML.split(';').filter((s) => s.trim());
    for (const stmt of dmlStatements) {
      const match = /INSERT\s+INTO\s+(\w+)[^VALUES]*VALUES\s*(.+)/is.exec(stmt.trim());
      if (match) {
        const tableName = match[1].toLowerCase();
        const valuesRaw = match[2];
        const rowTupleRegex = /\(([^)]+)\)/g;
        let tupleMatch;

        while ((tupleMatch = rowTupleRegex.exec(valuesRaw)) !== null) {
          const vals = tupleMatch[1].split(',').map((v) => {
            const raw = v.trim();
            if (raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1);
            if (!isNaN(Number(raw))) return Number(raw);
            if (raw.toUpperCase() === 'NULL') return null;
            return raw;
          });

          if (tables[tableName]) {
            const rowObj = {};
            tables[tableName].columns.forEach((col, idx) => {
              rowObj[col] = vals[idx];
            });
            tables[tableName].rows.push(rowObj);
          }
        }
      }
    }

    // 3. Parse SELECT query
    const selectMatch = /SELECT\s+(.+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+(.+?))?$/i.exec(query.trim());
    if (!selectMatch) {
      return { status: 'success', rows: [], columns: [], rowCount: 0, executionTimeMs: 1 };
    }

    const colListStr = selectMatch[1].trim();
    const tableName = selectMatch[2].trim().toLowerCase();
    const whereStr = selectMatch[3]?.trim();

    const targetTable = tables[tableName];
    if (!targetTable) {
      return { status: 'error', error: `Table "${tableName}" does not exist`, rows: [], columns: [], rowCount: 0, executionTimeMs: 1 };
    }

    let filteredRows = [...targetTable.rows];

    // Evaluate simple WHERE clause (e.g., salary > 80000)
    if (whereStr) {
      const whereMatch = /(\w+)\s*(=|>|<|>=|<=|!=)\s*(.+)/.exec(whereStr);
      if (whereMatch) {
        const field = whereMatch[1].toLowerCase();
        const op = whereMatch[2];
        let val = whereMatch[3].trim();
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        else if (!isNaN(Number(val))) val = Number(val);

        filteredRows = filteredRows.filter((r) => {
          const actual = r[field];
          if (op === '=') return actual === val;
          if (op === '>') return actual > val;
          if (op === '<') return actual < val;
          if (op === '>=') return actual >= val;
          if (op === '<=') return actual <= val;
          if (op === '!=') return actual !== val;
          return true;
        });
      }
    }

    // Projection
    let selectedCols = targetTable.columns;
    if (colListStr !== '*') {
      selectedCols = colListStr.split(',').map((c) => c.trim().toLowerCase());
    }

    const projectedRows = filteredRows.map((r) => {
      const pObj = {};
      for (const col of selectedCols) {
        pObj[col] = r[col] !== undefined ? r[col] : null;
      }
      return pObj;
    });

    const endTime = performance.now();
    return {
      status: 'success',
      rows: projectedRows,
      columns: selectedCols,
      rowCount: projectedRows.length,
      executionTimeMs: Math.max(1, Math.round(endTime - startTime)),
    };
  } catch (err) {
    return {
      status: 'error',
      error: err.message,
      rows: [],
      columns: [],
      rowCount: 0,
      executionTimeMs: 1,
    };
  }
};
