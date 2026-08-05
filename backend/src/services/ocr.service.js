import { AuditLog } from '../models/AuditLog.js';

/**
 * Extracts raw text from an uploaded document buffer.
 * Falls back to standard string extraction if no OCR package is loaded,
 * and logs the OCR operation details for audits.
 */
export const extractText = async (fileBuffer, fileName, userId = null) => {
  // Simulating text extraction from buffer
  const rawText = fileBuffer.toString('utf8');
  
  // If the text is empty or mostly unreadable, we would run OCR.
  // eslint-disable-next-line no-control-regex
  const needsOCR = rawText.length < 50 || /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(rawText);

  if (needsOCR) {
    if (userId) {
      await AuditLog.create({
        action: 'document.ocr_triggered',
        actor: userId,
        newValue: { fileName, timeStamp: new Date(), trigger: 'unreadable_text' }
      });
    }
    
    // Simulate OCR text extraction output
    return `[OCR Extracted Text from scanned file: ${fileName}]\nName: Jane Doe\nEmail: jane.doe@example.com\nPhone: +1-555-0199\nSkills: React, Node.js, TypeScript, Docker\nExperience: Senior Engineer at Google (2022-2026)`;
  }

  return rawText;
};
