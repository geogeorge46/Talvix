const plain = (value) => value?.toObject ? value.toObject() : JSON.parse(JSON.stringify(value));
export const sanitizeQuestionForCandidate = (question, { includeExplanation = false } = {}) => {
  const data = plain(question); delete data.correctAnswer; delete data.usageCount; delete data.company; delete data.createdBy; delete data.explanation;
  if (data.coding?.testCases) data.coding.testCases = data.coding.testCases.filter((test) => !test.isHidden).map(({ expectedOutput: _expectedOutput, ...test }) => test);
  if (includeExplanation && question.explanation) data.explanation = question.explanation;
  return data;
};
