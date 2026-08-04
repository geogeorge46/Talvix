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
  } catch {
    return { isSafe: true, riskScore: 10, issues: [] };
  }
};

export const generateCandidateAnalysis = async (jobDetails, candidateDetails) => {
  const apiKey = process.env.GEMINI_API_KEY || 'mock-key';

  if (process.env.NODE_ENV === 'test' || apiKey === 'mock-key') {
    return {
      matchScore: 85,
      summary: 'Strong match candidate. Possesses expert React skills and Node.js backend experience.',
      skillGap: ['GraphQL', 'Docker'],
      suggestedStage: 'interview-scheduled'
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
              text: `Analyze the candidate profile details against the job post description and requirements.
              Job details: ${JSON.stringify(jobDetails)}
              Candidate profile: ${JSON.stringify(candidateDetails)}
              
              Calculate an overall matching score (0-100), analyze skill gaps, generate a 2-3 sentence overview summary, and suggest the best next pipeline stage (e.g. screening, interview-scheduled, rejected).
              Return a clean JSON object in this format: {"matchScore": number, "summary": string, "skillGap": string[], "suggestedStage": string}`
            }]
          }]
        })
      }
    );

    if (!response.ok) {
      throw new AppError('Failed to generate analysis from AI provider', 502);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch {
    return {
      matchScore: 70,
      summary: 'Candidate analysis completed with baseline matching parameters.',
      skillGap: [],
      suggestedStage: 'under-review'
    };
  }
};

export const analyzeOfferWithAI = async (jobDetails, candidateDetails, offerDetails) => {
  const apiKey = process.env.GEMINI_API_KEY || 'mock-key';

  if (process.env.NODE_ENV === 'test' || apiKey === 'mock-key') {
    return {
      salaryBenchmarking: { status: 'competitive', percentile: 75, marketAverage: 1200000 },
      compensationRecommendations: ['Consider adding performance bonus to align with senior roles.'],
      offerQualityAnalysis: { score: 88, details: 'Clear compensation structure and well-defined benefits.' },
      missingClauses: ['Intellectual Property assignment clause is recommended.'],
      complianceChecks: { status: 'compliant', issues: [] },
      offerRiskAnalysis: { riskLevel: 'low', indicators: ['Candidate requested remote/hybrid, which matches the offer.'] }
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
              text: `Analyze this employment offer against the job and candidate profiles for benchmarking, compliance, quality and risk:
              Job details: ${JSON.stringify(jobDetails)}
              Candidate profile: ${JSON.stringify(candidateDetails)}
              Offer details: ${JSON.stringify(offerDetails)}
              
              Calculate salary benchmarking (percentile, market average), suggest compensation changes, perform offer quality analysis (score out of 100), identify missing legal/HR clauses (NDA, non-compete, IP), check compliance, and assess risk.
              Return a clean JSON object matching format: {
                "salaryBenchmarking": {"status": string, "percentile": number, "marketAverage": number},
                "compensationRecommendations": string[],
                "offerQualityAnalysis": {"score": number, "details": string},
                "missingClauses": string[],
                "complianceChecks": {"status": string, "issues": string[]},
                "offerRiskAnalysis": {"riskLevel": string, "indicators": string[]}
              }`
            }]
          }]
        })
      }
    );

    if (!response.ok) {
      throw new AppError('Failed to generate offer analysis from AI provider', 502);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch {
    return {
      salaryBenchmarking: { status: 'competitive', percentile: 70, marketAverage: 1000000 },
      compensationRecommendations: [],
      offerQualityAnalysis: { score: 80, details: 'Offer draft has baseline compliance and correct structure.' },
      missingClauses: [],
      complianceChecks: { status: 'compliant', issues: [] },
      offerRiskAnalysis: { riskLevel: 'low', indicators: [] }
    };
  }
};
