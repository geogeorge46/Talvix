import { executePublicCodingTests, executeAllCodingTests } from './codingExecution.service.js';

export const getOriginalBuggyCode = (question, language) => {
  const lang = (language || 'javascript').toLowerCase();
  const buggyMap = question.coding?.buggyCode || question.debugging?.buggyCode;
  if (buggyMap && typeof buggyMap === 'object') {
    const code = buggyMap instanceof Map ? buggyMap.get(lang) : buggyMap[lang];
    if (code) return code;
  }
  const starterMap = question.coding?.starterCode || question.debugging?.starterCode;
  if (starterMap && typeof starterMap === 'object') {
    const code = starterMap instanceof Map ? starterMap.get(lang) : starterMap[lang];
    if (code) return code;
  }
  return typeof starterMap === 'string' ? starterMap : '';
};

export const runDebuggingTests = async ({ sourceCode, language, question, adapter = null }) => {
  const result = await executePublicCodingTests({ sourceCode, language, question, adapter });
  const originalSourceCode = getOriginalBuggyCode(question, language);
  return {
    ...result,
    originalSourceCode,
    bugCategory: question.coding?.bugCategory || question.debugging?.bugCategory || question.bugCategory || 'logic-error',
  };
};

export const submitDebuggingFix = async ({ sourceCode, language, question, adapter = null }) => {
  const result = await executeAllCodingTests({ sourceCode, language, question, adapter });
  const originalSourceCode = getOriginalBuggyCode(question, language);
  return {
    ...result,
    originalSourceCode,
    bugCategory: question.coding?.bugCategory || question.debugging?.bugCategory || question.bugCategory || 'logic-error',
  };
};
