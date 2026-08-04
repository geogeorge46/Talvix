import * as blueprintService from '../services/blueprint.service.js';
import * as plagiarismService from '../services/plagiarism.service.js';
import * as reportService from '../services/report.service.js';
import * as questionService from '../services/question.service.js';
import * as analyticsService from '../services/assessmentAnalytics.service.js';
import { AssessmentAttempt } from '../models/AssessmentAttempt.js';

const handle = (action) => async (request, response, next) => {
  try {
    return await action(request, response);
  } catch (error) {
    return next(error);
  }
};

export const createBlueprint = handle(async (r, s) => {
  return s.status(201).json({
    success: true,
    message: 'Blueprint created successfully',
    data: { blueprint: await blueprintService.createBlueprint(r.company.id, r.user.id, r.body) }
  });
});

export const listBlueprints = handle(async (r, s) => {
  return s.json({
    success: true,
    data: { blueprints: await blueprintService.listBlueprints(r.company.id, r.query) }
  });
});

export const getBlueprint = handle(async (r, s) => {
  return s.json({
    success: true,
    data: { blueprint: await blueprintService.getBlueprint(r.company.id, r.params.blueprintId) }
  });
});

export const updateBlueprint = handle(async (r, s) => {
  return s.json({
    success: true,
    message: 'Blueprint updated successfully',
    data: { blueprint: await blueprintService.updateBlueprint(r.company.id, r.params.blueprintId, r.body) }
  });
});

export const deleteBlueprint = handle(async (r, s) => {
  return s.json({
    success: true,
    message: 'Blueprint deleted successfully',
    data: await blueprintService.deleteBlueprint(r.company.id, r.params.blueprintId)
  });
});

export const cloneBlueprint = handle(async (r, s) => {
  return s.status(201).json({
    success: true,
    message: 'Blueprint cloned successfully',
    data: { blueprint: await blueprintService.cloneBlueprint(r.company.id, r.params.blueprintId, r.user.id) }
  });
});

export const generateAssessment = handle(async (r, s) => {
  return s.status(201).json({
    success: true,
    message: 'Assessment generated from blueprint successfully',
    data: { assessment: await blueprintService.generateAssessmentFromBlueprint(r.company.id, r.params.blueprintId, r.user.id) }
  });
});

export const getPlagiarismReport = handle(async (r, s) => {
  return s.json({
    success: true,
    data: { report: await plagiarismService.getPlagiarismReport(r.company.id, r.params.assessmentId) }
  });
});

export const getCandidatePlagiarism = handle(async (r, s) => {
  return s.json({
    success: true,
    data: { report: await plagiarismService.getCandidatePlagiarismReport(r.company.id, r.params.assessmentId, r.params.candidateId) }
  });
});

export const triggerPlagiarismScan = handle(async (r, s) => {
  return s.json({
    success: true,
    message: 'Plagiarism scan completed successfully',
    data: { results: await plagiarismService.runPlagiarismScanForAssessment(r.company.id, r.params.assessmentId, r.user.id) }
  });
});

export const downloadReportHTML = handle(async (r, s) => {
  const { attempt, assignment } = await reportService.getReportData(r.company.id, r.params.attemptId, r.user.id);
  const html = reportService.generateAssessmentReportHTML(attempt, assignment);
  s.setHeader('Content-Type', 'text/html');
  return s.send(html);
});

export const downloadReportPDF = handle(async (r, s) => {
  const { attempt, assignment } = await reportService.getReportData(r.company.id, r.params.attemptId, r.user.id);
  const pdfBuffer = await reportService.generateAssessmentReportPDF(attempt, assignment);
  s.setHeader('Content-Type', 'application/pdf');
  s.setHeader('Content-Disposition', `attachment; filename=report-${attempt._id}.pdf`);
  return s.send(pdfBuffer);
});

export const getActiveAttempts = handle(async (r, s) => {
  const attempts = await AssessmentAttempt.find({
    assessment: r.params.assessmentId,
    company: r.company.id
  }).populate('candidate', 'fullName email').lean();

  const formatted = attempts.map(attempt => ({
    id: attempt._id,
    candidate: attempt.candidate,
    status: attempt.status,
    cheatingRiskScore: attempt.integrity?.cheatingRiskScore || 0,
    suspiciousEventsCount: attempt.integrity?.suspiciousEvents?.length || 0,
    saveCount: attempt.integrity?.saveCount || 0,
    expiresAt: attempt.expiresAt,
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt
  }));

  return s.json({
    success: true,
    data: { attempts: formatted }
  });
});

export const downloadCandidateReportHTML = handle(async (r, s) => {
  const { attempt, assignment } = await reportService.getReportData(null, r.params.attemptId, r.user.id, true);
  const html = reportService.generateAssessmentReportHTML(attempt, assignment);
  s.setHeader('Content-Type', 'text/html');
  return s.send(html);
});

export const downloadCandidateReportPDF = handle(async (r, s) => {
  const { attempt, assignment } = await reportService.getReportData(null, r.params.attemptId, r.user.id, true);
  const pdfBuffer = await reportService.generateAssessmentReportPDF(attempt, assignment);
  s.setHeader('Content-Type', 'application/pdf');
  s.setHeader('Content-Disposition', `attachment; filename=report-${attempt._id}.pdf`);
  return s.send(pdfBuffer);
});

export const rollbackQuestion = handle(async (r, s) => {
  return s.json({
    success: true,
    message: 'Question version rolled back successfully',
    data: { question: await questionService.rollbackQuestionVersion(r.company.id, r.params.questionId, r.body.version, r.user.id) }
  });
});

export const compareQuestion = handle(async (r, s) => {
  const versionA = parseInt(r.query.versionA, 10);
  const versionB = parseInt(r.query.versionB, 10);
  return s.json({
    success: true,
    data: await questionService.compareQuestionVersions(r.company.id, r.params.questionId, versionA, versionB)
  });
});

export const bulkImportQuestions = handle(async (r, s) => {
  return s.status(201).json({
    success: true,
    message: 'Questions bulk imported successfully',
    data: { questions: await questionService.bulkImport(r.company.id, r.body.questions, r.user.id) }
  });
});

export const bulkExportQuestions = handle(async (r, s) => {
  const questions = await questionService.bulkExport(r.company.id, r.query);
  return s.json({
    success: true,
    data: { questions }
  });
});

export const toggleQuestionFavorite = handle(async (r, s) => {
  return s.json({
    success: true,
    data: await questionService.toggleFavorite(r.company.id, r.params.questionId, r.user.id)
  });
});

export const getAssessmentLeaderboard = handle(async (r, s) => {
  return s.json({
    success: true,
    data: { leaderboard: await analyticsService.getLeaderboard(r.company.id, r.params.assessmentId, r.query) }
  });
});

export const getAssessmentBenchmarking = handle(async (r, s) => {
  return s.json({
    success: true,
    data: await analyticsService.getBenchmarking(r.company.id, r.query)
  });
});
