import { AIPrompt } from '../models/AIPrompt.js';
import { AppError } from '../shared/errors/AppError.js';

// Central registry of system default prompt templates
const DEFAULT_PROMPTS = {
  generate_job_description: {
    template: 'Write a professional job description for the title: "{{title}}". Requirements to include: "{{keyRequirements}}". Format output in clean Markdown.',
    requiredVariables: ['title', 'keyRequirements'],
    description: 'Generates a markdown formatted job description.'
  },
  suggest_skills: {
    template: 'Based on the job title "{{title}}" and description "{{description}}", suggest a list of 5-8 highly relevant technical skill tags. Return ONLY a comma-separated list of skills (e.g. React, Node.js, TypeScript).',
    requiredVariables: ['title', 'description'],
    description: 'Suggests comma-separated list of technical skills.'
  },
  perform_scam_check: {
    template: 'Analyze the following job details for scam indicators, misleading claims, bias, or safety issues. Job Title: "{{title}}". Description: "{{description}}". Return JSON object matching format: {"isSafe": boolean, "riskScore": number (0-100), "issues": string[]}',
    requiredVariables: ['title', 'description'],
    description: 'Checks if a job is safe or a scam.'
  },
  generate_candidate_analysis: {
    template: 'Analyze the candidate profile details against the job post description and requirements.\nJob details: {{jobDetails}}\nCandidate profile: {{candidateDetails}}\n\nCalculate an overall matching score (0-100), analyze skill gaps, generate a 2-3 sentence overview summary, and suggest the best next pipeline stage (e.g. screening, interview-scheduled, rejected).\nReturn a clean JSON object in this format: {"matchScore": number, "summary": string, "skillGap": string[], "suggestedStage": string}',
    requiredVariables: ['jobDetails', 'candidateDetails'],
    description: 'Analyzes a candidate profile against a job description.'
  },
  analyze_offer: {
    template: 'Analyze this employment offer against the job and candidate profiles for benchmarking, compliance, quality and risk:\nJob details: {{jobDetails}}\nCandidate profile: {{candidateDetails}}\nOffer details: {{offerDetails}}\n\nCalculate salary benchmarking (percentile, market average), suggest compensation recommendations, perform offer quality analysis (score out of 100), identify missing legal/HR clauses (NDA, non-compete, IP), check compliance, and assess risk.\nReturn a clean JSON object matching format: {\n  "salaryBenchmarking": {"status": string, "percentile": number, "marketAverage": number},\n  "compensationRecommendations": string[],\n  "offerQualityAnalysis": {"score": number, "details": string},\n  "missingClauses": string[],\n  "complianceChecks": {"status": string, "issues": string[]},\n  "offerRiskAnalysis": {"riskLevel": string, "indicators": string[]}\n}',
    requiredVariables: ['jobDetails', 'candidateDetails', 'offerDetails'],
    description: 'Analyzes offer details.'
  },
  evaluate_assessment: {
    template: 'Analyze this candidate\'s assessment attempt:\nAttempt: {{attemptDetails}}\nCandidate: {{candidateDetails}}\nQuestions: {{questionsDetails}}\n\nPerform a thorough evaluation including code quality analysis, time/space complexity estimation, coding style, bug detection, duplication check, skill inference, and an overall summary.\nReturn a clean JSON object in format: {\n  "codeQualityAnalysis": {"score": number, "comments": string},\n  "complexityEstimation": {"timeComplexity": string, "spaceComplexity": string},\n  "styleAnalysis": {"comments": string},\n  "bugDetection": {"count": number, "issues": string[]},\n  "duplicateCodeDetection": {"hasDuplicates": boolean, "matches": string[]},\n  "skillInference": string[],\n  "candidateSummary": string\n}',
    requiredVariables: ['attemptDetails', 'candidateDetails', 'questionsDetails'],
    description: 'Evaluates assessment attempt.'
  },
  resume_parse: {
    template: 'Extract all resume sections and return standard JSON object containing personalInfo (fullName, email, phone, address, country, state, city), professionalSummary (summary, objective, headline), skills (technical, frameworks, languages, databases, cloud, devops, tools, soft), experience (company, position, startDate, endDate, durationMonths, employmentType, responsibilities, technologies, achievements), education (degree, university, branch, cgpa, percentage, graduationYear), projects (title, description, techStack, github, liveUrl, durationMonths, role), certifications (name, provider, issueDate, expiryDate, credentialId), languages (language, proficiency), links (github, linkedin, portfolio, leetcode, hackerrank, kaggle), metrics (resumeScore, technicalScore, atsScore, experienceLevel, careerLevel, confidenceScore), and searchTokens. Text: "{{resumeText}}"',
    requiredVariables: ['resumeText'],
    description: 'Parses and extracts resume fields.'
  },
  job_parse: {
    template: 'Extract all job details and return structured JSON containing skills (required, preferred, soft), responsibilities, experience (minYears, maxYears, preferredDescription), education (degrees, branches, preferredDescription), certifications, languages (language, proficiency), industry, employmentType, location (country, state, city, type), salaryRange (min, max, currency), benefits, hiringSummary, riskFlags (category, message, severity), and searchTokens. Text: "{{jobText}}"',
    requiredVariables: ['jobText'],
    description: 'Parses job descriptions.'
  },
  resume_scoring: {
    template: 'Calculate match score (0-100), technical score, and ATS score matching resume details against job details. Return JSON: {"resumeScore": number, "technicalScore": number, "atsScore": number, "level": string}',
    requiredVariables: ['resumeDetails', 'jobDetails'],
    description: 'Calculates resume scoring metrics.'
  },
  text_embedding: {
    template: 'Return a mock array of 768 float numbers representing the text embedding coordinates. Text: "{{text}}"',
    requiredVariables: ['text'],
    description: 'Generates coordinates for text queries.'
  },
  candidate_matching: {
    template: 'Compare resume profile: {{resumeDetails}} and job requirements: {{jobDetails}}.\nEvaluate and return weighted scores out of 100 in JSON format:\n{\n  "overallScore": number,\n  "skillsScore": number,\n  "experienceScore": number,\n  "educationScore": number,\n  "projectScore": number,\n  "certificationScore": number,\n  "softSkillScore": number,\n  "languageScore": number,\n  "locationScore": number,\n  "salaryScore": number,\n  "availabilityScore": number,\n  "reasoning": string,\n  "strengths": string[],\n  "weaknesses": string[],\n  "hiringRecommendation": string,\n  "interviewReadiness": string,\n  "offerReadiness": string,\n  "riskFactors": string[]\n}',
    requiredVariables: ['resumeDetails', 'jobDetails'],
    description: 'Evaluates weighted scores and fit comparisons.'
  },
  skill_gap_analysis: {
    template: 'Compare candidate skills: {{resumeSkills}} against job required skills: {{jobSkills}}.\nGenerate skill gaps and learning roadmaps in JSON format:\n{\n  "matchedSkills": string[],\n  "missingSkills": string[],\n  "criticalMissingSkills": string[],\n  "recommendedSkills": string[],\n  "learningRoadmap": string[],\n  "certificationRecommendations": string[],\n  "estimatedLearningTime": string,\n  "priorityRanking": string[]\n}',
    requiredVariables: ['resumeSkills', 'jobSkills'],
    description: 'Generates skills gap and learning plans.'
  },
  parse_search_query: {
    template: 'Parse natural language search query: "{{query}}". Return JSON mapping: {"query": string, "skills": string[], "experienceYears": number, "location": string}',
    requiredVariables: ['query'],
    description: 'Parses semantic parameters from search input.'
  },
  copilot_intent_detection: {
    template: 'Detect recruiter intent from prompt: "{{query}}" with conversation history: {{history}}.\nReturn JSON: {"intent": string, "entities": string[], "filters": {"skills": string[], "location": string, "experienceYears": number}, "sort": string, "confidence": number, "reasoning": string}',
    requiredVariables: ['query', 'history'],
    description: 'Classifies recruiter intents and filters.'
  },
  copilot_candidate_comparison: {
    template: 'Compare these candidate profiles: {{candidatesList}}.\nReturn detailed comparison JSON:\n{\n  "overallWinner": string,\n  "reasoning": string,\n  "comparisonGrid": {\n    "skills": string,\n    "projects": string,\n    "experience": string,\n    "education": string,\n    "leadership": string,\n    "certifications": string\n  }\n}',
    requiredVariables: ['candidatesList'],
    description: 'Evaluates and compares candidate sets.'
  },
  copilot_hiring_insights: {
    template: 'Analyze applications matching parameters for pipeline analytics: {{pipelineData}}.\nReturn JSON: {"bestCandidate": string, "hiddenGems": string[], "commonSkillGaps": string[], "averageMatchScore": number, "hiringRisk": string, "offerAcceptanceProbability": number}',
    requiredVariables: ['pipelineData'],
    description: 'Generates pipeline insights matrices.'
  },
  assessment_generation: {
    template: 'Generate assessment questions for job: {{jobDetails}}.\nReturn JSON: {"questions": [{"type": "single-choice" | "multiple-choice" | "coding" | "sql", "prompt": string, "defaultMarks": number, "difficulty": "easy" | "medium" | "hard", "options": [{"id": "a", "text": "choice"}], "correctAnswer": string, "coding": {"starterCode": {"javascript": "code"}, "testCases": [{"input": "inp", "expectedOutput": "out", "weight": number}]}}]}',
    requiredVariables: ['jobDetails'],
    description: 'Generates assessment blueprints.'
  },
  interview_generation: {
    template: 'Generate dynamic interview questions for job: {{jobDetails}} and candidate: {{candidateDetails}}.\nReturn JSON: {"questions": [{"prompt": string, "expectedAnswer": string, "hints": string[], "difficulty": "easy" | "medium" | "hard", "estimatedTimeSeconds": number}]}',
    requiredVariables: ['jobDetails', 'candidateDetails'],
    description: 'Generates structured interview kits.'
  },
  answer_evaluation: {
    template: 'Evaluate response: "{{response}}" to question: "{{question}}".\nReturn JSON: {"awardedMarks": number, "isCorrect": boolean, "requiresManualReview": boolean, "feedback": string}',
    requiredVariables: ['response', 'question'],
    description: 'Grades candidate submissions.'
  },
  resume_review: {
    template: 'Evaluate resume: "{{resumeContent}}".\nReturn JSON: {"atsScore": number, "grammarScore": number, "formattingScore": number, "technicalScore": number, "projectScore": number, "overallScore": number, "strengths": string[], "weaknesses": string[], "recommendations": string[], "missingKeywords": string[], "missingSections": string[]}',
    requiredVariables: ['resumeContent'],
    description: 'Generates detailed resume quality reviews.'
  },
  fraud_detection: {
    template: 'Scan resume content: "{{resumeContent}}" for contradictions, timelines, or boilerplate copying.\nReturn JSON: {"fraudScore": number, "riskLevel": "low" | "medium" | "high", "confidence": number, "reasons": string[], "timelineIssues": string[], "duplicateSections": string[], "copiedProjects": string[], "aiProbability": number}',
    requiredVariables: ['resumeContent'],
    description: 'Flags inconsistencies and plagiarism.'
  },
  career_intelligence: {
    template: 'Predict career score parameters for candidate profile: "{{profileContent}}".\nReturn JSON: {"technicalScore": number, "communicationScore": number, "assessmentScore": number, "resumeScore": number, "interviewScore": number, "cultureFit": number, "learningSpeed": number, "overallCandidateRating": number, "hiringReadiness": "ready" | "near-ready" | "needs-training", "expectedSalary": number, "expectedNoticePeriodDays": number, "hiringRecommendation": "hire" | "strong hire" | "maybe" | "reject"}',
    requiredVariables: ['profileContent'],
    description: 'Calculates skill radar ratings and recommendations.'
  },
  chat_summary: {
    template: 'Summarize chat conversation transcript: "{{chatLogs}}".\nReturn JSON: {"highlights": string[], "strengths": string[], "concerns": string[], "suggestedQuestions": string[], "actionItems": string[]}',
    requiredVariables: ['chatLogs'],
    description: 'Summarizes chat history logs.'
  },
  executive_analytics: {
    template: 'Analyze hiring metrics logs: "{{metricsLogs}}".\nReturn JSON: {"aiSummary": string, "forecasts": {"predictedHiringDemand": number, "expectedCompletionDays": number, "budgetForecastUSD": number}, "riskAlerts": string[], "recommendations": string[]}',
    requiredVariables: ['metricsLogs'],
    description: 'Compiles high-level weekly/monthly executive insights and forecasts.'
  },
  agent_execution: {
    template: 'Process agent instruction: "{{instruction}}" with memory context: "{{memoryContext}}".\nReturn JSON: {"decision": string, "justification": string, "riskScore": number, "nextSteps": string[]}',
    requiredVariables: ['instruction', 'memoryContext'],
    description: 'Executes autonomous agent recruiting decisions.'
  }
};

/**
 * Checks string inputs for standard prompt injection strings.
 */
export const detectPromptInjection = (text) => {
  if (typeof text !== 'string') return false;

  const injectionPatterns = [
    /ignore (all )?previous instructions/i,
    /system override/i,
    /you are now (a|an)/i,
    /forget what we talked about/i,
    /new system instructions/i,
    /bypass the restrictions/i,
    /dan mode/i,
    /do not follow the rules/i,
    /assistant mode/i
  ];

  return injectionPatterns.some(pattern => pattern.test(text));
};

/**
 * Resolves active prompt template from DB or fallbacks.
 */
export const getPromptTemplate = async (key, version = null) => {
  const query = { key };
  if (version !== null) {
    query.version = version;
  } else {
    query.isActive = true;
  }

  // Find active version
  const dbPrompt = await AIPrompt.findOne(query).sort({ version: -1 });
  if (dbPrompt) {
    return {
      template: dbPrompt.template,
      version: dbPrompt.version,
      requiredVariables: dbPrompt.requiredVariables || []
    };
  }

  // Fallback to static defaults
  const defaultPrompt = DEFAULT_PROMPTS[key];
  if (!defaultPrompt) {
    throw new AppError(`Prompt template key '${key}' not found`, 404);
  }

  return {
    template: defaultPrompt.template,
    version: 1,
    requiredVariables: defaultPrompt.requiredVariables
  };
};

/**
 * Substitutes variables into a template, executing protection rules.
 */
export const renderPrompt = async (key, variables, version = null) => {
  const { template, requiredVariables, version: activeVersion } = await getPromptTemplate(key, version);

  // Validate presence
  for (const variable of requiredVariables) {
    if (variables[variable] === undefined || variables[variable] === null) {
      throw new AppError(`Required prompt variable '${variable}' is missing`, 400);
    }
  }

  // Prompt injection protection
  for (const [varName, varVal] of Object.entries(variables)) {
    const stringVal = typeof varVal === 'object' ? JSON.stringify(varVal) : String(varVal);
    if (detectPromptInjection(stringVal)) {
      throw new AppError(`Potential prompt injection detected in variable '${varName}'`, 400);
    }
  }

  // Variable replacement
  let renderedText = template;
  for (const [varName, varVal] of Object.entries(variables)) {
    const stringVal = typeof varVal === 'object' ? JSON.stringify(varVal, null, 2) : String(varVal);
    renderedText = renderedText.replaceAll(`{{${varName}}}`, stringVal);
  }

  return {
    promptText: renderedText,
    version: activeVersion
  };
};
export { DEFAULT_PROMPTS };
