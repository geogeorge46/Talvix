import { AIProvider } from '../models/AIProvider.js';
import { getConfiguration } from './aiConfig.service.js';
import { getCache, setCache, generateCacheKey } from './cache.service.js';
import { executeWithRetry } from './retry.service.js';
import { logUsage } from './aiUsage.service.js';
import { renderPrompt } from './prompt.service.js';
import { AppError } from '../shared/errors/AppError.js';

// Simple token bucket state track mapping
const rateLimitTracker = new Map();

/**
 * Checks and decrements rate limits.
 */
const checkRateLimit = (companyId, limitConfig) => {
  const key = companyId || 'global';
  const now = Date.now();
  const limit = limitConfig.requestsPerMinute;

  let bucket = rateLimitTracker.get(key);
  if (!bucket) {
    bucket = { tokens: limit, lastRefill: now };
  } else {
    // Refill tokens proportionally
    const timePassedMs = now - bucket.lastRefill;
    const refillTokens = (timePassedMs * limit) / 60000;
    bucket.tokens = Math.min(limit, bucket.tokens + refillTokens);
    bucket.lastRefill = now;
  }

  if (bucket.tokens < 1) {
    return false;
  }

  bucket.tokens -= 1;
  rateLimitTracker.set(key, bucket);
  return true;
};

/**
 * Multiplies token amounts by provider configuration pricing rate metrics.
 */
const calculateCost = (provider, inputTokens, outputTokens) => {
  const inputRate = provider.costPerInputToken || 0;
  const outputRate = provider.costPerOutputToken || 0;
  return (inputTokens * inputRate) + (outputTokens * outputRate);
};

/**
 * Dispatches physical provider requests (Gemini).
 */
const callProvider = async (provider, model, promptText) => {
  const apiKey = provider.apiKey || process.env.GEMINI_API_KEY || 'mock-key';

  if (provider.name === 'gemini') {
    // Under testing and demo environments, execute mock API logs
    if (process.env.NODE_ENV === 'test' || apiKey === 'mock-key') {
      const isJson = promptText.includes('JSON') || promptText.includes('json');
      let text = 'Mock AI text response.';

      if (isJson) {
        if (promptText.includes('agent_execution') || promptText.includes('Process agent instruction')) {
          text = JSON.stringify({
            decision: 'Shortlist Candidate & Send Coding Assessment',
            justification: 'Candidate satisfies all React & backend criteria.',
            riskScore: 5,
            nextSteps: ['Notify hiring manager', 'Generate assessment link']
          });
        } else if (promptText.includes('executive_analytics') || promptText.includes('Analyze hiring metrics')) {
          text = JSON.stringify({
            aiSummary: 'Hiring funnel velocity is steady. Drop-offs are concentrated in assessments.',
            forecasts: {
              predictedHiringDemand: 15,
              expectedCompletionDays: 25,
              budgetForecastUSD: 5000
            },
            riskAlerts: ['High drop-off in React assessment section'],
            recommendations: ['Shorten React assessments to reduce drop-offs']
          });
        } else if (promptText.includes('chat_summary') || promptText.includes('Summarize chat')) {
          text = JSON.stringify({
            highlights: ['Candidate demonstrated solid knowledge of React Hooks.'],
            strengths: ['Experienced with high-scale microservices'],
            concerns: ['Notice period is slightly longer (60 days)'],
            suggestedQuestions: ['Ask details about Kubernetes deployments'],
            actionItems: ['Schedule system design interview']
          });
        } else if (promptText.includes('resume_review') || promptText.includes('Evaluate resume')) {
          text = JSON.stringify({
            atsScore: 85,
            grammarScore: 90,
            formattingScore: 80,
            technicalScore: 88,
            projectScore: 82,
            overallScore: 85,
            strengths: ['Clear project summaries', 'Quantified impacts'],
            weaknesses: ['Vague summary keywords'],
            recommendations: ['Add dynamic skill highlights'],
            missingKeywords: ['Docker', 'Kubernetes'],
            missingSections: ['Certifications']
          });
        } else if (promptText.includes('fraud_detection') || promptText.includes('Scan resume content')) {
          text = JSON.stringify({
            fraudScore: 12,
            riskLevel: 'low',
            confidence: 95,
            reasons: ['Consistent references and employment durations.'],
            timelineIssues: [],
            duplicateSections: [],
            copiedProjects: [],
            aiProbability: 8
          });
        } else if (promptText.includes('career_intelligence') || promptText.includes('Predict career score')) {
          text = JSON.stringify({
            technicalScore: 88,
            communicationScore: 82,
            assessmentScore: 90,
            resumeScore: 85,
            interviewScore: 80,
            cultureFit: 85,
            learningSpeed: 90,
            overallCandidateRating: 86,
            hiringReadiness: 'ready',
            expectedSalary: 120000,
            expectedNoticePeriodDays: 30,
            hiringRecommendation: 'hire'
          });
        } else if (promptText.includes('assessment_generation') || promptText.includes('assessment questions')) {
          text = JSON.stringify({
            questions: [
              {
                type: 'single-choice',
                prompt: 'What is the runtime of binary search?',
                defaultMarks: 5,
                difficulty: 'easy',
                options: [
                  { id: 'a', text: 'O(N)' },
                  { id: 'b', text: 'O(log N)' }
                ],
                correctAnswer: 'b'
              },
              {
                type: 'coding',
                prompt: 'Write a function sum(a, b) returning sum.',
                defaultMarks: 10,
                difficulty: 'medium',
                options: [],
                correctAnswer: null,
                coding: {
                  starterCode: { javascript: 'function sum(a, b) {\n  return 0;\n}' },
                  testCases: [
                    { input: '1,2', expectedOutput: '3', weight: 5 }
                  ]
                }
              }
            ]
          });
        } else if (promptText.includes('interview_generation') || promptText.includes('interview questions')) {
          text = JSON.stringify({
            questions: [
              {
                prompt: 'Explain how event loops function in Node.js.',
                expectedAnswer: 'It processes asynchronous tasks using queues.',
                hints: ['Consider macro and micro tasks.'],
                difficulty: 'medium',
                estimatedTimeSeconds: 180
              }
            ]
          });
        } else if (promptText.includes('answer_evaluation') || promptText.includes('Evaluate response')) {
          text = JSON.stringify({
            awardedMarks: 8,
            isCorrect: true,
            requiresManualReview: false,
            feedback: 'The candidate solution is optimal and passed all visible test cases.'
          });
        } else if (promptText.includes('copilot_intent_detection') || promptText.includes('Detect recruiter intent')) {
          text = JSON.stringify({
            intent: 'search_candidates',
            entities: ['React', 'AWS'],
            filters: {
              skills: ['React', 'AWS'],
              location: 'Kerala',
              experienceYears: 2
            },
            sort: 'score_desc',
            confidence: 0.95,
            reasoning: 'The recruiter is searching for React candidates with AWS experience.'
          });
        } else if (promptText.includes('copilot_candidate_comparison') || promptText.includes('Compare these candidate')) {
          text = JSON.stringify({
            overallWinner: 'Jane Doe',
            reasoning: 'Jane Doe excels in leadership skills and framework certifications compared to other profiles.',
            comparisonGrid: {
              skills: 'Jane has React/Node.js, Bob has Node.js/Java',
              projects: 'Jane built 3 core projects, Bob built 1 legacy platform',
              experience: 'Jane has 4 years, Bob has 3 years',
              education: 'Both hold CS Degrees',
              leadership: 'Jane managed a team of 4 engineers',
              certifications: 'Jane holds AWS Solutions Architect certification'
            }
          });
        } else if (promptText.includes('copilot_hiring_insights') || promptText.includes('Analyze applications')) {
          text = JSON.stringify({
            bestCandidate: 'Jane Doe',
            hiddenGems: ['Alice Smith'],
            commonSkillGaps: ['Docker', 'CI/CD'],
            averageMatchScore: 84,
            hiringRisk: 'Low',
            offerAcceptanceProbability: 88
          });
        } else if (promptText.includes('candidate_matching') || promptText.includes('weighted scores')) {
          text = JSON.stringify({
            overallScore: 88,
            skillsScore: 92,
            experienceScore: 85,
            educationScore: 90,
            projectScore: 80,
            certificationScore: 75,
            softSkillScore: 90,
            languageScore: 95,
            locationScore: 100,
            salaryScore: 90,
            availabilityScore: 100,
            reasoning: 'Candidate matches major technical stacks perfectly with slight experience overrides.',
            strengths: ['Expert in React', 'Solid Node.js backgrounds'],
            weaknesses: ['Missing Docker certifications'],
            hiringRecommendation: 'Strong Hire',
            interviewReadiness: 'High',
            offerReadiness: 'Medium',
            riskFactors: ['Salary is at the top of budget']
          });
        } else if (promptText.includes('skill_gap_analysis') || promptText.includes('learningRoadmap')) {
          text = JSON.stringify({
            matchedSkills: ['React', 'Node.js', 'MongoDB'],
            missingSkills: ['Docker', 'Redis'],
            criticalMissingSkills: ['Docker'],
            recommendedSkills: ['Kubernetes'],
            learningRoadmap: ['1. Basic Docker Setup', '2. Compose deployments'],
            certificationRecommendations: ['Docker Certified Associate'],
            estimatedLearningTime: '2 weeks',
            priorityRanking: ['Docker', 'Redis']
          });
        } else if (promptText.includes('parse_search_query') || promptText.includes('natural language')) {
          text = JSON.stringify({
            query: 'React Developer',
            skills: ['React', 'AWS'],
            experienceYears: 2,
            location: 'Kerala'
          });
        } else if (promptText.includes('resume') || promptText.includes('personalInfo')) {
          text = JSON.stringify({
            personalInfo: { fullName: 'Jane Doe', email: 'jane.doe@example.com', phone: '+1-555-0199', address: '123 St', country: 'USA', state: 'CA', city: 'San Jose' },
            professionalSummary: { summary: 'Senior Engineer', objective: 'Objective', headline: 'Headline' },
            skills: { technical: ['React', 'Node.js', 'TypeScript', 'Docker'], frameworks: [], languages: [], databases: [], cloud: [], devops: [], tools: [], soft: [] },
            experience: [],
            education: [],
            projects: [],
            certifications: [],
            languages: [],
            links: { github: 'github.com/jane' },
            metrics: { resumeScore: 85, technicalScore: 90, atsScore: 80, experienceLevel: 'Senior', careerLevel: 'Senior', confidenceScore: 95 },
            searchTokens: ['Jane', 'React', 'Node.js', 'TypeScript']
          });
        } else if (promptText.includes('job') || promptText.includes('hiringSummary')) {
          text = JSON.stringify({
            skills: { required: ['TypeScript', 'Node.js'], preferred: [], soft: [] },
            responsibilities: [],
            experience: { minYears: 3, maxYears: 6 },
            education: { degrees: [], branches: [] },
            certifications: [],
            languages: [],
            industry: 'Software',
            employmentType: 'Full-time',
            location: { country: 'USA', city: 'San Jose', type: 'onsite' },
            salaryRange: { min: 100000, max: 150000 },
            benefits: [],
            hiringSummary: 'Backend engineer wanted',
            riskFlags: [],
            searchTokens: ['Backend', 'TypeScript']
          });
        } else if (promptText.includes('scam') || promptText.includes('safety') || promptText.includes('Safe')) {
          text = JSON.stringify({ isSafe: true, riskScore: 5, issues: [] });
        } else if (promptText.includes('skills') || promptText.includes('suggest')) {
          text = 'React, Node.js, TypeScript';
        } else if (promptText.includes('matching score') || promptText.includes('candidate profile') || promptText.includes('Analysis')) {
          text = JSON.stringify({ matchScore: 85, summary: 'Matches perfectly.', skillGap: ['Docker'], suggestedStage: 'interview-scheduled' });
        } else if (promptText.includes('offer') || promptText.includes('salaryBenchmarking')) {
          text = JSON.stringify({
            salaryBenchmarking: { status: 'competitive', percentile: 75, marketAverage: 120000 },
            compensationRecommendations: [],
            offerQualityAnalysis: { score: 90, details: 'Excellent offer' },
            missingClauses: [],
            complianceChecks: { status: 'compliant', issues: [] },
            offerRiskAnalysis: { riskLevel: 'low', indicators: [] }
          });
        } else if (promptText.includes('assessment attempt') || promptText.includes('codeQualityAnalysis')) {
          text = JSON.stringify({
            codeQualityAnalysis: { score: 85, comments: 'Good quality' },
            complexityEstimation: { timeComplexity: 'O(N)', spaceComplexity: 'O(1)' },
            styleAnalysis: { comments: 'Clean code' },
            bugDetection: { count: 0, issues: [] },
            duplicateCodeDetection: { hasDuplicates: false, matches: [] },
            skillInference: ['JavaScript'],
            candidateSummary: 'Passes coding criteria'
          });
        } else {
          text = JSON.stringify({ success: true, mock: true });
        }
      }

      return {
        text,
        inputTokens: Math.ceil(promptText.length / 4),
        outputTokens: Math.ceil(text.length / 4),
        durationMs: 50
      };
    }

    const start = Date.now();
    const endpoint = provider.baseUrl || 'https://generativelanguage.googleapis.com/v1beta/models';
    
    const response = await fetch(
      `${endpoint}/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }]
        })
      }
    );

    const durationMs = Date.now() - start;

    if (!response.ok) {
      const errText = await response.text();
      throw new AppError(`Gemini Provider Error: ${response.status} - ${errText}`, response.status);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const inputTokens = data.usageMetadata?.promptTokenCount || Math.ceil(promptText.length / 4);
    const outputTokens = data.usageMetadata?.candidatesTokenCount || Math.ceil(text.length / 4);

    return { text, inputTokens, outputTokens, durationMs };
  } else {
    throw new AppError(`Provider '${provider.name}' is not yet implemented.`, 501);
  }
};

/**
 * Centered gateway call method.
 */
export const invokeAIGateway = async (promptKey, promptVariables, context = {}) => {
  const { companyId = null, userId = null, ipAddress = 'Unknown', userAgent = 'Unknown' } = context;

  // 1. Load configuration
  const config = await getConfiguration(companyId);

  // 2. Check rate limit
  if (!checkRateLimit(companyId, config.rateLimits)) {
    throw new AppError('AI Rate Limit Exceeded. Please try again later.', 429);
  }

  // 3. Render prompt (verifies constraints + injection filter check)
  const { promptText, version } = await renderPrompt(promptKey, promptVariables);

  // 4. Resolve provider
  let providerName = config.primaryProvider;
  let activeProvider = await AIProvider.findOne({ name: providerName, isActive: true });

  if (!activeProvider && config.fallbackProvider) {
    providerName = config.fallbackProvider;
    activeProvider = await AIProvider.findOne({ name: providerName, isActive: true });
  }

  if (!activeProvider) {
    // Setup system fallback details if DB has no configs loaded
    activeProvider = {
      name: 'gemini',
      displayName: 'Google Gemini (Fallback)',
      isActive: true,
      costPerInputToken: 0.000000075,
      costPerOutputToken: 0.0000003
    };
  }

  const targetModel = config.modelMappings?.[promptKey] || config.modelMappings?.fast || 'gemini-2.5-flash';

  // 5. Query Cache
  let cacheKey = null;
  if (config.cachingEnabled) {
    cacheKey = generateCacheKey(promptKey, promptVariables, activeProvider.name, targetModel);
    const cachedResponse = await getCache(cacheKey);
    if (cachedResponse !== null) {
      // Record cache hit
      await logUsage({
        companyId,
        userId,
        providerName: activeProvider.name,
        modelName: targetModel,
        promptKey,
        promptVersion: version,
        tokensInput: 0,
        tokensOutput: 0,
        cost: 0,
        durationMs: 0,
        status: 'success',
        ipAddress,
        userAgent,
        requestPayload: { promptVariables, cacheHit: true },
        responsePayload: cachedResponse
      });
      return cachedResponse;
    }
  }

  // 6. Invoke call with Retry wrapper
  let result;
  try {
    result = await executeWithRetry(
      () => callProvider(activeProvider, targetModel, promptText),
      {
        maxRetries: config.retryCount,
        initialDelayMs: config.retryBackoffMs
      }
    );
  } catch (error) {
    // Log failed execution
    await logUsage({
      companyId,
      userId,
      providerName: activeProvider.name,
      modelName: targetModel,
      promptKey,
      promptVersion: version,
      tokensInput: 0,
      tokensOutput: 0,
      cost: 0,
      durationMs: 0,
      status: 'failed',
      errorMessage: error.message,
      ipAddress,
      userAgent,
      requestPayload: { promptVariables },
      responsePayload: null
    });
    throw error;
  }

  // 7. Calculate costs
  const cost = calculateCost(activeProvider, result.inputTokens, result.outputTokens);

  // 8. Update cache
  if (config.cachingEnabled && cacheKey) {
    await setCache(cacheKey, result.text, config.cacheTtlSeconds, companyId);
  }

  // 9. Log successful usage
  await logUsage({
    companyId,
    userId,
    providerName: activeProvider.name,
    modelName: targetModel,
    promptKey,
    promptVersion: version,
    tokensInput: result.inputTokens,
    tokensOutput: result.outputTokens,
    cost,
    durationMs: result.durationMs,
    status: 'success',
    ipAddress,
    userAgent,
    requestPayload: { promptVariables },
    responsePayload: result.text
  });

  return result.text;
};
