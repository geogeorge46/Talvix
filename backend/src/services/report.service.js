import PDFDocument from 'pdfkit';
import { AssessmentAttempt } from '../models/AssessmentAttempt.js';
import { AssessmentAssignment } from '../models/AssessmentAssignment.js';
import { AppError } from '../shared/errors/AppError.js';
import { AuditLog } from '../models/AuditLog.js';

/**
 * Generate a printable HTML layout of the assessment report.
 */
export const generateAssessmentReportHTML = (attempt, assignment) => {
  const qBreakdown = attempt.questionResults.map((r, i) => `
    <div class="question-row">
      <h3>Question ${i + 1} (${r.questionType})</h3>
      <p><strong>Awarded Marks:</strong> ${r.awardedMarks} / ${r.marks}</p>
      <p><strong>Status:</strong> ${r.isCorrect ? 'Correct' : r.requiresManualReview ? 'Pending Manual Review' : 'Incorrect'}</p>
      ${r.feedback ? `<p><strong>Feedback:</strong> ${r.feedback}</p>` : ''}
      ${r.codingResult ? `
        <div class="code-result">
          <p><strong>Execution Status:</strong> ${r.codingResult.status || 'N/A'}</p>
          <p><strong>Execution Time:</strong> ${r.codingResult.executionTimeMs || 0} ms</p>
        </div>
      ` : ''}
    </div>
  `).join('');

  const aiSection = attempt.aiAnalysis ? `
    <div class="section">
      <h2>AI Evaluation Report</h2>
      <p><strong>Summary Recommendation:</strong> ${attempt.aiAnalysis.recommendation || 'N/A'}</p>
      <p><strong>Code Quality Score:</strong> ${attempt.aiAnalysis.codeQualityAnalysis?.score || 'N/A'} / 100</p>
      <p><strong>Complexity Analysis:</strong> ${attempt.aiAnalysis.codeQualityAnalysis?.complexityNotes || 'N/A'}</p>
      <p><strong>Strengths:</strong> ${attempt.aiAnalysis.strengths?.join(', ') || 'N/A'}</p>
      <p><strong>Weaknesses:</strong> ${attempt.aiAnalysis.weaknesses?.join(', ') || 'N/A'}</p>
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Assessment Candidate Report</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 40px; background: #fafafa; }
          .report-container { max-width: 800px; margin: 0 auto; background: #fff; padding: 40px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
          h1, h2, h3 { color: #1e293b; }
          h1 { border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-top: 0; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; background: #f8fafc; padding: 20px; border-radius: 6px; }
          .meta-item strong { display: block; color: #64748b; font-size: 0.85rem; text-transform: uppercase; }
          .section { margin-bottom: 40px; }
          .section h2 { border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; font-size: 1.4rem; }
          .question-row { border: 1px solid #e2e8f0; border-radius: 6px; padding: 20px; margin-bottom: 15px; background: #fff; }
          .code-result { background: #f1f5f9; padding: 10px 15px; border-radius: 4px; font-size: 0.9rem; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="report-container">
          <h1>Assessment Report</h1>
          <div class="meta-grid">
            <div class="meta-item">
              <strong>Assessment Title</strong>
              <span>${assignment.assessmentSnapshot.title}</span>
            </div>
            <div class="meta-item">
              <strong>Candidate ID</strong>
              <span>${attempt.candidate}</span>
            </div>
            <div class="meta-item">
              <strong>Overall Score</strong>
              <span>${attempt.evaluation.percentage}%</span>
            </div>
            <div class="meta-item">
              <strong>Outcome</strong>
              <span>${attempt.evaluation.passed ? 'Passed' : 'Not Passed'}</span>
            </div>
          </div>
          <div class="section">
            <h2>Detailed Score Breakdown</h2>
            ${qBreakdown}
          </div>
          ${aiSection}
        </div>
      </body>
    </html>
  `;
};

/**
 * Generate a PDF layout of the report using PDFKit.
 */
export const generateAssessmentReportPDF = async (attempt, assignment) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];
      
      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', err => reject(err));

      // Document Title
      doc.fontSize(22).fillColor('#1e293b').text('Talvix Candidate Assessment Report', { align: 'center' });
      doc.moveDown(1.5);

      // Meta Block
      doc.fontSize(11).fillColor('#64748b').text('ASSESSMENT SUMMARY', { underline: true });
      doc.moveDown(0.5);
      doc.fillColor('#334155');
      doc.text(`Assessment: ${assignment.assessmentSnapshot.title}`);
      doc.text(`Candidate ID: ${attempt.candidate}`);
      doc.text(`Overall Score: ${attempt.evaluation.percentage}%`);
      doc.text(`Outcome: ${attempt.evaluation.passed ? 'PASSED' : 'NOT PASSED'}`);
      doc.text(`Completed At: ${attempt.completedAt ? attempt.completedAt.toISOString() : 'N/A'}`);
      doc.moveDown(2);

      // Questions Breakdown
      doc.fontSize(14).fillColor('#1e293b').text('Detailed Breakdown', { underline: true });
      doc.moveDown(0.8);
      
      attempt.questionResults.forEach((r, index) => {
        doc.fontSize(11).fillColor('#334155').text(`Question ${index + 1} (${r.questionType})`);
        doc.fontSize(10).fillColor('#64748b').text(`Marks Awarded: ${r.awardedMarks} / ${r.marks}`);
        doc.text(`Status: ${r.isCorrect ? 'Correct' : r.requiresManualReview ? 'Manual Review' : 'Incorrect'}`);
        if (r.feedback) {
          doc.text(`Feedback: ${r.feedback}`);
        }
        doc.moveDown(1);
      });

      // AI Analysis
      if (attempt.aiAnalysis) {
        doc.addPage();
        doc.fontSize(14).fillColor('#1e293b').text('AI Evaluation Summary', { underline: true });
        doc.moveDown(0.8);
        doc.fontSize(11).fillColor('#334155');
        doc.text(`Recommendation: ${attempt.aiAnalysis.recommendation || 'N/A'}`);
        doc.moveDown(0.5);
        doc.text(`Code Quality: ${attempt.aiAnalysis.codeQualityAnalysis?.score || 'N/A'} / 100`);
        doc.text(`Complexity Notes: ${attempt.aiAnalysis.codeQualityAnalysis?.complexityNotes || 'N/A'}`);
        doc.moveDown(0.5);
        doc.text(`Strengths: ${attempt.aiAnalysis.strengths?.join(', ') || 'N/A'}`);
        doc.text(`Weaknesses: ${attempt.aiAnalysis.weaknesses?.join(', ') || 'N/A'}`);
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Handles report query downloads.
 */
export const getReportData = async (company, attemptId, actor = null, isCandidate = false) => {
  const attemptQuery = isCandidate ? { _id: attemptId, candidate: actor } : { _id: attemptId, company };
  const attempt = await AssessmentAttempt.findOne(attemptQuery);
  if (!attempt) throw new AppError('Assessment attempt not found', 404);

  const assignmentQuery = isCandidate ? { _id: attempt.assignment, candidate: actor } : { _id: attempt.assignment, company };
  const assignment = await AssessmentAssignment.findOne(assignmentQuery);
  if (!assignment) throw new AppError('Assessment assignment not found', 404);

  if (actor) {
    await AuditLog.create({
      action: 'ASSESSMENT_REPORT_DOWNLOADED',
      actor,
      company: attempt.company,
      entityType: 'assessment-attempt',
      entityId: attemptId
    });
  }

  return { attempt, assignment };
};
