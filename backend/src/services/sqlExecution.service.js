import { SQLDataset } from '../models/SQLDataset.js';
import { executeInSQLSandbox } from './sqlSandbox.service.js';
import { compareSQLResultSets } from './sqlComparator.js';
import { AppError } from '../shared/errors/AppError.js';

export const getSQLQuestionSchema = async (questionSnapshot) => {
  const dataset = await SQLDataset.findOne({ question: questionSnapshot.questionId });
  if (dataset) {
    return {
      schemaDDL: dataset.schemaDDL,
      seedDataDML: dataset.seedDataDML,
      tables: dataset.tables,
      publicSampleRows: dataset.publicSampleRows,
    };
  }

  // Fallback to inline SQL configuration on questionSnapshot if present
  const inline = questionSnapshot.coding || questionSnapshot.sqlConfig || {};
  return {
    schemaDDL: inline.schemaDDL || 'CREATE TABLE example (id INT, name TEXT);',
    tables: inline.tables || [
      {
        tableName: 'example',
        columns: [
          { name: 'id', type: 'INT', isPrimaryKey: true },
          { name: 'name', type: 'TEXT', isPrimaryKey: false },
        ],
        sampleRows: [{ id: 1, name: 'Sample Record' }],
      },
    ],
    publicSampleRows: inline.sampleRows || [],
  };
};

export const executePublicSQLQuery = async ({ sqlQuery, question }) => {
  const schemaInfo = await getSQLQuestionSchema(question);

  const candidateResult = await executeInSQLSandbox({
    schemaDDL: schemaInfo.schemaDDL,
    seedDataDML: schemaInfo.seedDataDML || '',
    query: sqlQuery,
  });

  return {
    status: candidateResult.status,
    columns: candidateResult.columns,
    rows: candidateResult.rows,
    rowCount: candidateResult.rowCount,
    executionTimeMs: candidateResult.executionTimeMs,
    error: candidateResult.error || null,
  };
};

export const executeAllSQLTests = async ({ sqlQuery, question }) => {
  const schemaInfo = await getSQLQuestionSchema(question);
  const dataset = await SQLDataset.findOne({ question: question.questionId });

  const expectedQuery = dataset?.expectedQuery || question.coding?.expectedQuery || question.sqlConfig?.expectedQuery || 'SELECT * FROM example';

  const [candidateResult, expectedResult] = await Promise.all([
    executeInSQLSandbox({
      schemaDDL: schemaInfo.schemaDDL,
      seedDataDML: schemaInfo.seedDataDML || '',
      query: sqlQuery,
    }),
    executeInSQLSandbox({
      schemaDDL: schemaInfo.schemaDDL,
      seedDataDML: schemaInfo.seedDataDML || '',
      query: expectedQuery,
    }),
  ]);

  const comparison = compareSQLResultSets(candidateResult, expectedResult, sqlQuery);
  const questionMarks = question.marks || question.defaultMarks || 25;
  const functionalScore = comparison.passed ? questionMarks : 0;

  return {
    status: candidateResult.status === 'error' ? 'error' : comparison.passed ? 'passed' : 'failed',
    passed: comparison.passed,
    reason: comparison.reason,
    matchDetails: comparison.matchDetails,
    candidateResult: {
      columns: candidateResult.columns,
      rows: candidateResult.rows,
      rowCount: candidateResult.rowCount,
      error: candidateResult.error || null,
    },
    executionTimeMs: candidateResult.executionTimeMs,
    functionalScore,
    finalScore: functionalScore,
  };
};
