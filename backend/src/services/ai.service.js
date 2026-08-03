import { AppError } from '../shared/errors/AppError.js';

export const generateJobDescription = async (title, keyRequirements) => {
  const apiKey = process.env.GEMINI_API_KEY || 'mock-key';

  if (process.env.NODE_ENV === 'test' || apiKey === 'mock-key') {
    return `### Job Description: ${title}\n\nWe are looking for a skilled ${title} to join our team.\n\n**Requirements:**\n${keyRequirements || 'Standard experience required.'}`;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Write a professional job description for the title: "${title}". Requirements to include: "${keyRequirements}". Format output in clean Markdown.`
            }]
          }]
        })
      }
    );

    if (!response.ok) {
      throw new AppError('Failed to generate description from AI provider', 502);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('AI provider communication error', 502);
  }
};

export const suggestSkills = async (title, description) => {
  const apiKey = process.env.GEMINI_API_KEY || 'mock-key';

  if (process.env.NODE_ENV === 'test' || apiKey === 'mock-key') {
    return ['React', 'Node.js', 'TypeScript', 'TailwindCSS'];
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Based on the job title "${title}" and description "${description}", suggest a list of 5-8 highly relevant technical skill tags. Return ONLY a comma-separated list of skills (e.g. React, Node.js, TypeScript).`
            }]
          }]
        })
      }
    );

    if (!response.ok) {
      throw new AppError('Failed to suggest skills from AI provider', 502);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return text.split(',').map(s => s.trim()).filter(Boolean);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('AI provider communication error', 502);
  }
};

export const performScamCheck = async (title, description) => {
  const apiKey = process.env.GEMINI_API_KEY || 'mock-key';

  if (process.env.NODE_ENV === 'test' || apiKey === 'mock-key') {
    return {
      isSafe: true,
      riskScore: 5,
      issues: []
    };
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Analyze the following job details for scam indicators, misleading claims, bias, or safety issues. Job Title: "${title}". Description: "${description}". Return JSON object matching format: {"isSafe": boolean, "riskScore": number (0-100), "issues": string[]}`
            }]
          }]
        })
      }
    );

    if (!response.ok) {
      throw new AppError('Failed to verify safety check from AI provider', 502);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    return { isSafe: true, riskScore: 10, issues: [] };
  }
};
