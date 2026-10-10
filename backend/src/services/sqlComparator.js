const canonicalizeValue = (val) => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return Number(val.toFixed(4));
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'boolean') return val;
  return String(val).trim();
};

const canonicalizeRow = (row) => {
  const sortedKeys = Object.keys(row)
    .map((k) => k.toLowerCase())
    .sort();
  const obj = {};
  const origKeys = Object.keys(row);

  for (const origKey of origKeys) {
    const normKey = origKey.toLowerCase();
    obj[normKey] = canonicalizeValue(row[origKey]);
  }
  return obj;
};

const sortRows = (rows) => {
  return [...rows].sort((a, b) => {
    const strA = JSON.stringify(a);
    const strB = JSON.stringify(b);
    return strA.localeCompare(strB);
  });
};

export const compareSQLResultSets = (candidateResult, expectedResult, originalQuery = '') => {
  if (candidateResult.status === 'error') {
    return {
      passed: false,
      reason: `Query Error: ${candidateResult.error}`,
      matchDetails: { rowCountMatch: false, columnMatch: false, contentMatch: false },
    };
  }

  const candRows = candidateResult.rows || [];
  const expRows = expectedResult.rows || [];

  const hasOrderBy = /\bORDER\s+BY\b/i.test(originalQuery);

  const normCandRows = candRows.map(canonicalizeRow);
  const normExpRows = expRows.map(canonicalizeRow);

  // 1. Row count comparison
  const rowCountMatch = normCandRows.length === normExpRows.length;
  if (!rowCountMatch) {
    return {
      passed: false,
      reason: `Row count mismatch. Expected ${normExpRows.length} rows, but got ${normCandRows.length} rows.`,
      matchDetails: { rowCountMatch: false, columnMatch: false, contentMatch: false },
    };
  }

  if (normExpRows.length === 0 && normCandRows.length === 0) {
    return {
      passed: true,
      reason: 'Empty result sets match',
      matchDetails: { rowCountMatch: true, columnMatch: true, contentMatch: true },
    };
  }

  // 2. Column count comparison
  const candCols = Object.keys(normCandRows[0] || {}).sort();
  const expCols = Object.keys(normExpRows[0] || {}).sort();

  const columnMatch = candCols.length === expCols.length && candCols.every((col, idx) => col === expCols[idx]);

  if (!columnMatch) {
    return {
      passed: false,
      reason: `Column mismatch. Expected columns [${expCols.join(', ')}], but got [${candCols.join(', ')}]`,
      matchDetails: { rowCountMatch: true, columnMatch: false, contentMatch: false },
    };
  }

  // 3. Content comparison
  let finalCand = normCandRows;
  let finalExp = normExpRows;

  if (!hasOrderBy) {
    finalCand = sortRows(normCandRows);
    finalExp = sortRows(normExpRows);
  }

  let contentMatch = true;
  for (let i = 0; i < finalExp.length; i++) {
    const rCand = finalCand[i];
    const rExp = finalExp[i];

    for (const col of expCols) {
      if (rCand[col] !== rExp[col]) {
        contentMatch = false;
        break;
      }
    }
    if (!contentMatch) break;
  }

  return {
    passed: contentMatch,
    reason: contentMatch
      ? 'Result sets match perfectly'
      : hasOrderBy
      ? 'Row values or row order do not match expected result'
      : 'Row values do not match expected result',
    matchDetails: { rowCountMatch: true, columnMatch: true, contentMatch },
  };
};
