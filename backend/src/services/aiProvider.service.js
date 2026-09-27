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
 * Identifies if a given API key is missing or a placeholder.
 */
const isMockOrPlaceholderKey = (key) => {
  if (!key || typeof key !== 'string') return true;
  const k = key.trim();
  return (
    k === '' ||
    k === 'mock-key' ||
    k === 'undefined' ||
    k === 'null' ||
    k.startsWith('your_') ||
    k.startsWith('your-') ||
    k.includes('placeholder') ||
    k.includes('api_key_here') ||
    k.includes('change_me')
  );
};

/**
 * Generates realistic, production-ready mock questions based on prompt keywords.
 */
const buildContextualQuestions = (promptText) => {
  const p = promptText.toLowerCase();
  const topicMatch = promptText.match(/topic:\s*"([^"]+)"/i);
  const skillsMatch = promptText.match(/skills:\s*"([^"]+)"/i);
  const diffMatch = promptText.match(/difficulty:\s*"([^"]+)"/i);
  const typeMatch = promptText.match(/type:\s*"([^"]+)"/i);
  const countMatch = promptText.match(/generate\s+(\d+)/i);
  const topicStr = (topicMatch ? topicMatch[1] : '').toLowerCase();
  const skillsStr = (skillsMatch ? skillsMatch[1] : '').toLowerCase();
  const typeFilter = (typeMatch ? typeMatch[1] : '').toLowerCase();
  const userScope = `${topicStr} ${skillsStr} ${promptText}`.toLowerCase();

  let diff = 'medium';
  if (diffMatch && ['easy', 'medium', 'hard'].includes(diffMatch[1].toLowerCase())) {
    diff = diffMatch[1].toLowerCase();
  }

  const targetCount = countMatch ? Math.min(Math.max(parseInt(countMatch[1], 10), 1), 10) : 3;

  const pool = [];

  if (userScope.includes('react') || userScope.includes('frontend') || userScope.includes('css') || userScope.includes('ui') || userScope.includes('next') || userScope.includes('vue')) {
    pool.push({
      type: 'single-choice',
      prompt: 'In React 18 with Concurrent Mode, what is the primary benefit of wrapping an update inside `startTransition`?',
      defaultMarks: 5,
      difficulty: diff,
      category: 'Frontend',
      skills: ['React', 'Concurrent Mode', 'State Management'],
      options: [
        { id: 'a', text: 'The state update executes synchronously and blocks user clicks.' },
        { id: 'b', text: 'The update is marked as non-urgent, allowing urgent user interactions (like typing or clicking) to interrupt it.' },
        { id: 'c', text: 'It spawns a Web Worker thread to compute DOM reconciliation.' },
        { id: 'd', text: 'It forces re-rendering of all ancestor memoized components.' }
      ],
      correctAnswer: 'b'
    });
    pool.push({
      type: 'coding',
      prompt: 'Implement a custom debounce function `debounce(fn, delayMs)` that delays invoking `fn` until after `delayMs` milliseconds have elapsed since the last time the debounced function was invoked.',
      defaultMarks: 15,
      difficulty: diff,
      category: 'Frontend',
      skills: ['JavaScript', 'Async', 'Event Handling'],
      options: [],
      correctAnswer: null,
      coding: {
        starterCode: {
          javascript: 'function debounce(fn, delayMs) {\n  let timer = null;\n  return function (...args) {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn.apply(this, args), delayMs);\n  };\n}'
        },
        testCases: [
          { input: 'rapid_calls_5', expectedOutput: 'invoked_once', weight: 5, isHidden: false },
          { input: 'spaced_calls_2', expectedOutput: 'invoked_twice', weight: 10, isHidden: true }
        ]
      }
    });
    pool.push({
      type: 'work-sample',
      prompt: 'Design a Virtualized Data Grid Component capable of rendering 100,000 rows at 60 FPS. Detail dynamic row-height calculation, viewport buffer windowing, and memory recycling strategies.',
      defaultMarks: 25,
      difficulty: diff,
      category: 'Frontend',
      skills: ['Architecture', 'Performance', 'React'],
      options: [],
      correctAnswer: null,
      deliverable: {
        type: 'mixed',
        instructions: 'Submit a prototype repository URL or CodeSandbox link, along with an architectural overview in PDF or ZIP format explaining buffer calculation and scroll performance.',
        allowedFormats: ['.pdf', '.zip'],
        maxFiles: 2
      },
      rubric: {
        criteria: [
          { name: 'Viewport Windowing & Math', description: 'Accurate dynamic height computation and scroll offset calculation', maxMarks: 15, weight: 60 },
          { name: 'DOM Recycling & Memory', description: 'Zero memory leaks and consistent 60fps frame rate', maxMarks: 10, weight: 40 }
        ],
        evaluationNotes: 'Evaluate based on reusability, performance, and accessibility.'
      }
    });
  } else if (userScope.includes('sql') || userScope.includes('postgres') || userScope.includes('database') || userScope.includes('mongo') || userScope.includes('schema') || userScope.includes('b-tree')) {
    pool.push({
      type: 'single-choice',
      prompt: 'In PostgreSQL, what is the key performance benefit of creating a composite B-Tree index on `(tenant_id, created_at DESC)` compared to separate single-column indexes?',
      defaultMarks: 5,
      difficulty: diff,
      category: 'Database',
      skills: ['PostgreSQL', 'Indexing', 'Query Optimization'],
      options: [
        { id: 'a', text: 'It eliminates the need for Bitmap Index Scan and Index Intersect when filtering by tenant and ordering by timestamp.' },
        { id: 'b', text: 'It converts the table storage engine into columnar format.' },
        { id: 'c', text: 'It disables Write-Ahead Logging (WAL) for updates to these fields.' },
        { id: 'd', text: 'It automatically distributes the tenant records across physical shards.' }
      ],
      correctAnswer: 'a'
    });
    pool.push({
      type: 'coding',
      prompt: 'Write an idempotent function or query returning the latest status record for each user given an audit table with `user_id`, `status`, and `recorded_at` columns.',
      defaultMarks: 15,
      difficulty: diff,
      category: 'Database',
      skills: ['SQL', 'Window Functions', 'Optimization'],
      options: [],
      correctAnswer: null,
      coding: {
        starterCode: {
          javascript: 'function getDeduplicatedSQL() {\n  return "SELECT DISTINCT ON (user_id) user_id, status, recorded_at FROM user_audit ORDER BY user_id, recorded_at DESC;";\n}'
        },
        testCases: [
          { input: 'duplicates_check', expectedOutput: 'distinct_users', weight: 5, isHidden: false },
          { input: 'ordering_check', expectedOutput: 'latest_timestamps', weight: 10, isHidden: true }
        ]
      }
    });
    pool.push({
      type: 'work-sample',
      prompt: 'Develop a zero-downtime database migration and sharding strategy for an application scaling from 100K to 50M daily active users. Address cross-shard queries and data rollback.',
      defaultMarks: 25,
      difficulty: diff,
      category: 'Database',
      skills: ['Database Design', 'Sharding', 'High Availability'],
      options: [],
      correctAnswer: null,
      deliverable: {
        type: 'mixed',
        instructions: 'Upload an architectural specification PDF detailing shard key selection, dual-write backfill verification, and fallback rollback protocols.',
        allowedFormats: ['.pdf', '.zip'],
        maxFiles: 2
      },
      rubric: {
        criteria: [
          { name: 'Shard Distribution & Hotspot Mitigation', description: 'Prevents partition imbalance and handles write surges', maxMarks: 15, weight: 60 },
          { name: 'Migration & Rollback Feasibility', description: 'Clean dual-write pattern with verified zero-downtime rollback', maxMarks: 10, weight: 40 }
        ],
        evaluationNotes: 'Evaluate operational feasibility and fault recovery.'
      }
    });
  } else if (topicStr.includes('python') || skillsStr.includes('python') || userScope.includes('fastapi') || userScope.includes('django') || userScope.includes('flask')) {
    pool.push({
      type: 'single-choice',
      prompt: 'In an asynchronous FastAPI application, why should CPU-bound computations (such as image processing or heavy encryption) NOT be run directly inside an `async def` route handler?',
      defaultMarks: 5,
      difficulty: diff,
      category: 'Backend',
      skills: ['Python', 'asyncio', 'FastAPI'],
      options: [
        { id: 'a', text: 'It raises an unhandled SyntaxError at runtime.' },
        { id: 'b', text: 'It blocks the single-threaded event loop, starving all other concurrent requests from progressing.' },
        { id: 'c', text: 'FastAPI allocates a new thread pool automatically for async def routes.' },
        { id: 'd', text: 'Async def functions cannot access numerical Python libraries like numpy or hashlib.' }
      ],
      correctAnswer: 'b'
    });
    pool.push({
      type: 'coding',
      prompt: 'Implement an LRU (Least Recently Used) Cache class with `get(key)` and `put(key, value)` methods operating in O(1) time complexity.',
      defaultMarks: 15,
      difficulty: diff,
      category: 'Backend',
      skills: ['Python', 'Data Structures', 'Caching'],
      options: [],
      correctAnswer: null,
      coding: {
        starterCode: {
          javascript: 'class LRUCache {\n  constructor(capacity) {\n    this.capacity = capacity;\n    this.map = new Map();\n  }\n  get(key) {\n    if (!this.map.has(key)) return -1;\n    const val = this.map.get(key);\n    this.map.delete(key);\n    this.map.set(key, val);\n    return val;\n  }\n  put(key, value) {\n    if (this.map.has(key)) this.map.delete(key);\n    else if (this.map.size >= this.capacity) {\n      this.map.delete(this.map.keys().next().value);\n    }\n    this.map.set(key, value);\n  }\n}'
        },
        testCases: [
          { input: 'put(1,1),put(2,2),get(1)', expectedOutput: '1', weight: 5, isHidden: false },
          { input: 'put(3,3),get(2)', expectedOutput: '-1', weight: 10, isHidden: true }
        ]
      }
    });
    pool.push({
      type: 'work-sample',
      prompt: 'Design an event-driven telemetry ingestion service in Python handling 50,000 requests/sec with validation, deduplication, and dead-letter queue routing.',
      defaultMarks: 25,
      difficulty: diff,
      category: 'Backend',
      skills: ['Python', 'Architecture', 'Streaming'],
      options: [],
      correctAnswer: null,
      deliverable: {
        type: 'mixed',
        instructions: 'Submit a prototype repository link and an architectural specification PDF detailing backpressure control and fault recovery.',
        allowedFormats: ['.pdf', '.zip'],
        maxFiles: 2
      },
      rubric: {
        criteria: [
          { name: 'Backpressure & Queue Reliability', description: 'Handles traffic spikes without dropping messages', maxMarks: 15, weight: 60 },
          { name: 'Idempotency & Deduplication', description: 'Accurate duplicate filtering and audit safety', maxMarks: 10, weight: 40 }
        ],
        evaluationNotes: 'Check for idempotent processing and graceful degradation.'
      }
    });
  } else {
    // General Backend / System Design
    pool.push({
      type: 'single-choice',
      prompt: 'In a distributed microservices ecosystem, what is the primary operational role of the Circuit Breaker pattern?',
      defaultMarks: 5,
      difficulty: diff,
      category: 'System Design',
      skills: ['Microservices', 'Resilience', 'Fault Tolerance'],
      options: [
        { id: 'a', text: 'To encrypt inter-service RPC communications with mTLS.' },
        { id: 'b', text: 'To fail fast and prevent cascading system outages when a downstream service becomes degraded or unresponsive.' },
        { id: 'c', text: 'To automatically increase container replicas during CPU spikes.' },
        { id: 'd', text: 'To guarantee distributed database transactions across independent clusters.' }
      ],
      correctAnswer: 'b'
    });
    pool.push({
      type: 'coding',
      prompt: 'Implement a Token Bucket rate limiter function `createRateLimiter(maxTokens, refillRatePerSec)` that throttles excessive traffic and refills tokens proportionally over time.',
      defaultMarks: 15,
      difficulty: diff,
      category: 'Backend',
      skills: ['Concurrency', 'Rate Limiting', 'Algorithms'],
      options: [],
      correctAnswer: null,
      coding: {
        starterCode: {
          javascript: 'function createRateLimiter(maxTokens, refillRatePerSec) {\n  let tokens = maxTokens;\n  let lastRefill = Date.now();\n  return function allowRequest() {\n    const now = Date.now();\n    const elapsed = (now - lastRefill) / 1000;\n    tokens = Math.min(maxTokens, tokens + elapsed * refillRatePerSec);\n    lastRefill = now;\n    if (tokens >= 1) {\n      tokens -= 1;\n      return true;\n    }\n    return false;\n  };\n}'
        },
        testCases: [
          { input: 'burst_within_capacity', expectedOutput: 'true', weight: 5, isHidden: false },
          { input: 'burst_exceeding_capacity', expectedOutput: 'false', weight: 10, isHidden: true }
        ]
      }
    });
    pool.push({
      type: 'work-sample',
      prompt: 'Design a resilient Financial Ledger and Transaction Settlement Service requiring absolute idempotency, audit trail recording, and sub-50ms p99 latency SLAs.',
      defaultMarks: 25,
      difficulty: diff,
      category: 'System Design',
      skills: ['System Architecture', 'Idempotency', 'Distributed Transactions'],
      options: [],
      correctAnswer: null,
      deliverable: {
        type: 'mixed',
        instructions: 'Submit an architectural specification PDF detailing request validation flows, deduplication mechanisms, consensus models, and dead-letter handling.',
        allowedFormats: ['.pdf', '.zip'],
        maxFiles: 2
      },
      rubric: {
        criteria: [
          { name: 'Idempotency & Consistency Guarantees', description: 'Prevents double-charging and handles network partitions safely', maxMarks: 15, weight: 60 },
          { name: 'Observability & Fault Isolation', description: 'Structured audit telemetry, graceful degradation, and disaster recovery', maxMarks: 10, weight: 40 }
        ],
        evaluationNotes: 'Evaluate based on production readiness, disaster recovery, and edge cases.'
      }
    });
  }

  // If specific question type requested
  if (typeFilter === 'coding' || p.includes('type: "coding"') || p.includes('type: coding')) {
    const codingQ = pool.find(q => q.type === 'coding') || pool[1];
    return Array(targetCount).fill(null).map((_, i) => ({
      ...codingQ,
      prompt: targetCount > 1 ? `${codingQ.prompt} (Variant ${i + 1})` : codingQ.prompt
    }));
  }
  if (typeFilter === 'work-sample' || p.includes('type: "work-sample"') || p.includes('type: work-sample')) {
    const wsQ = pool.find(q => q.type === 'work-sample') || pool[2];
    return Array(targetCount).fill(null).map((_, i) => ({
      ...wsQ,
      prompt: targetCount > 1 ? `${wsQ.prompt} (Scenario ${i + 1})` : wsQ.prompt
    }));
  }
  if (typeFilter === 'single-choice' || typeFilter === 'multiple-choice' || p.includes('type: "single-choice"') || p.includes('type: single-choice') || p.includes('type: "multiple-choice"')) {
    const mcqQ = pool.find(q => q.type === 'single-choice') || pool[0];
    return Array(targetCount).fill(null).map((_, i) => ({
      ...mcqQ,
      prompt: targetCount > 1 ? `${mcqQ.prompt} (Part ${i + 1})` : mcqQ.prompt
    }));
  }

  const result = [];
  for (let i = 0; i < targetCount; i++) {
    result.push(pool[i % pool.length]);
  }
  return result;
};

/**
 * Centrally manages mock responses for offline, testing, and development fallback.
 */
const getMockResponse = (promptText) => {
  const isJson = promptText.includes('JSON') || promptText.includes('json');
  let text = 'Mock AI text response.';

  if (!isJson && (promptText.includes('Write a comprehensive, professional job description') || promptText.includes('Write a professional job description') || promptText.includes('generate_job_description'))) {
    const titleMatch = promptText.match(/position "([^"]+)"/) || promptText.match(/title: "([^"]+)"/);
    const title = titleMatch ? titleMatch[1] : 'Software Engineer';
    const companyMatch = promptText.match(/Company: ([^\n]+)/);
    const companyName = companyMatch && companyMatch[1].trim() ? companyMatch[1].trim() : 'Our Company';
    const industryMatch = promptText.match(/Industry: ([^\n]+)/);
    const industry = industryMatch && industryMatch[1].trim() ? industryMatch[1].trim() : 'Technology';
    const aboutMatch = promptText.match(/About Company: ([^\n]+)/);
    const about = aboutMatch && aboutMatch[1].trim() ? aboutMatch[1].trim() : `${companyName} is an innovative organization in the ${industry} sector committed to delivering high-impact solutions and building world-class technology products.`;
    const benefitsMatch = promptText.match(/Company Benefits: ([^\n]+)/);
    const benefits = benefitsMatch && benefitsMatch[1].trim() ? benefitsMatch[1].trim() : '';
    const skillsMatch = promptText.match(/Skills: ([^\n]+)/);
    const skills = skillsMatch && skillsMatch[1].trim() ? skillsMatch[1].trim() : '';
    const workModeMatch = promptText.match(/Work Mode: ([^\n]+)/);
    const workMode = workModeMatch && workModeMatch[1].trim() ? workModeMatch[1].trim() : '';
    const locationMatch = promptText.match(/Location: ([^\n]+)/);
    const location = locationMatch && locationMatch[1].trim() ? locationMatch[1].trim() : '';
    const empMatch = promptText.match(/Employment Type: ([^\n]+)/);
    const employmentType = empMatch && empMatch[1].trim() ? empMatch[1].trim() : '';
    const deptMatch = promptText.match(/Department: ([^\n]+)/);
    const department = deptMatch && deptMatch[1].trim() ? deptMatch[1].trim() : '';

    const roleDetails = [
      workMode ? `**${workMode.charAt(0).toUpperCase() + workMode.slice(1)}**` : '',
      employmentType ? `**${employmentType.charAt(0).toUpperCase() + employmentType.slice(1)}**` : '',
      location ? `based in **${location}**` : ''
    ].filter(Boolean).join(' · ');

    const keyReqMatch = promptText.match(/Key Requirements: ([^\n]+)/) || promptText.match(/Requirements to include: "([^"]+)"/);
    const keyRequirements = keyReqMatch && keyReqMatch[1].trim() && keyReqMatch[1].trim() !== '.' ? keyReqMatch[1].trim() : '';

    const reqsCombined = [
      skills ? skills.split(',').map(s => `- Demonstrated proficiency with **${s.trim()}**`).join('\n') : '',
      keyRequirements ? `- Core requirements: **${keyRequirements}**` : ''
    ].filter(Boolean).join('\n');

    const skillsList = reqsCombined || `- Solid experience in modern software design and scalable architecture.\n- Strong problem-solving abilities and analytical thinking.\n- Commitment to continuous learning and best practices.`;


    const benefitsList = benefits
      ? benefits.split(',').map(b => `- ${b.trim()}`).join('\n')
      : `- Competitive compensation and equity options.\n- Comprehensive health, dental, and vision insurance.\n- Flexible working hours and hybrid/remote work culture.\n- Continuous learning allowance and conference stipends.`;

    return `# ${title} — ${companyName}

### About ${companyName}
${about}

### About the Role
${companyName} is seeking a passionate and talented **${title}** to join our ${department ? `${department} team` : 'team'}${roleDetails ? ` (${roleDetails})` : ''}. In this position, you will collaborate with experienced professionals to design, implement, and maintain mission-critical systems that drive business growth and elevate user experience.

### Key Responsibilities
- Architect, build, and deploy reliable, performant, and secure solutions.
- Collaborate cross-functionally with product managers, designers, and domain specialists.
- Write clean, well-tested, and maintainable code adhering to industry standards.
- Participate in code reviews, technical discussions, and architectural planning sessions.
- Troubleshoot performance issues, optimize bottlenecks, and contribute to system resilience.

### Qualifications & Skills
${skillsList}
- Strong verbal and written communication skills with the ability to articulate complex concepts.
- Proactive team player with an entrepreneurial mindset and attention to detail.

### What We Offer
${benefitsList}`;
  }

  if (!isJson && (promptText.includes('suggest_skills') || promptText.includes('suggest a list') || promptText.includes('skills') || promptText.includes('technical skill'))) {
    const titleMatch = promptText.match(/title\s*"(.*?)"/i) || promptText.match(/title:\s*"(.*?)"/i) || promptText.match(/position\s*"(.*?)"/i);
    const titleStr = (titleMatch ? titleMatch[1] : '').toLowerCase();
    const fullText = promptText.toLowerCase();
    
    if (titleStr.includes('angular') || (fullText.includes('angular') && !titleStr.includes('react') && !titleStr.includes('fullstack'))) {
      return 'Angular, TypeScript, RxJS, HTML5, CSS3, NgRx, Jasmine, Karma';
    }
    if (titleStr.includes('vue') || (fullText.includes('vue') && !titleStr.includes('react') && !titleStr.includes('fullstack'))) {
      return 'Vue.js, JavaScript, TypeScript, Pinia, Vuex, HTML5, CSS3, Vite';
    }
    if (titleStr.includes('fullstack') || titleStr.includes('react') || fullText.includes('react')) {
      return 'React, Node.js, TypeScript, JavaScript, Express, HTML5, CSS3';
    }
    if (titleStr.includes('node') || titleStr.includes('express') || titleStr.includes('backend')) {
      return 'Node.js, Express, JavaScript, TypeScript, MongoDB, REST API, Microservices';
    }
    if (titleStr.includes('python') || titleStr.includes('django') || titleStr.includes('fastapi')) {
      return 'Python, Django, FastAPI, PostgreSQL, Docker, REST API, PyTest';
    }
    if (titleStr.includes('java') || titleStr.includes('spring')) {
      return 'Java, Spring Boot, Microservices, Hibernate, Maven, PostgreSQL';
    }
    if (titleStr.includes('devops') || titleStr.includes('cloud') || titleStr.includes('aws')) {
      return 'AWS, Docker, Kubernetes, Terraform, CI/CD, Linux, Bash';
    }
    if (titleStr.includes('data') || titleStr.includes('machine learning') || titleStr.includes('ai') || titleStr.includes('ml')) {
      return 'Python, SQL, Pandas, Scikit-learn, TensorFlow, PyTorch, Data Analysis';
    }
    if (titleStr.includes('android') || titleStr.includes('kotlin')) {
      return 'Kotlin, Android SDK, Jetpack Compose, Coroutines, Gradle';
    }
    if (titleStr.includes('ios') || titleStr.includes('swift')) {
      return 'Swift, SwiftUI, iOS SDK, Xcode, REST API';
    }
    if (titleStr.includes('flutter') || titleStr.includes('dart')) {
      return 'Dart, Flutter, State Management, Firebase, REST API';
    }
    if (titleStr.includes('design') || titleStr.includes('ui') || titleStr.includes('ux')) {
      return 'Figma, UI Design, Wireframing, User Research, Prototyping, Design Systems';
    }
    if (titleStr.includes('qa') || titleStr.includes('test')) {
      return 'Selenium, Cypress, Automated Testing, Jest, Postman, QA Methodology';
    }
    
    return 'JavaScript, TypeScript, HTML5, CSS3, REST API, Git';
  }


  if (isJson) {
    if (promptText.includes('agent_execution') || promptText.includes('Process agent instruction')) {
      text = JSON.stringify({
        decision: 'Shortlist Candidate & Send Coding Assessment',
        justification: 'Candidate satisfies all React & backend criteria.',
        riskScore: 5,
        nextSteps: ['Notify hiring manager', 'Generate assessment link']
      });
    } else if (promptText.includes('evaluate_assessment') || promptText.includes('codeQualityAnalysis') || promptText.includes('assessment attempt')) {
      text = JSON.stringify({
        codeQualityAnalysis: { score: 85, comments: 'Good quality' },
        complexityEstimation: { timeComplexity: 'O(N)', spaceComplexity: 'O(1)' },
        styleAnalysis: { comments: 'Clean code' },
        bugDetection: { count: 0, issues: [] },
        duplicateCodeDetection: { hasDuplicates: false, matches: [] },
        skillInference: ['JavaScript'],
        candidateSummary: 'Passes coding criteria'
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
    } else if (
      promptText.includes('assessment_generation') ||
      promptText.includes('question_bank_generation') ||
      promptText.includes('assessment questions') ||
      promptText.includes('production-ready assessment questions')
    ) {
      text = JSON.stringify({
        questions: buildContextualQuestions(promptText)
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
    } else if (promptText.includes('Analyze the candidate profile details against') || promptText.includes('Calculate an overall matching score')) {
      text = JSON.stringify({ matchScore: 85, summary: 'Matches perfectly.', skillGap: ['GraphQL', 'Docker'], suggestedStage: 'interview-scheduled' });
    } else if (promptText.includes('matching score') || promptText.includes('candidate profile') || promptText.includes('Analysis')) {
      text = JSON.stringify({ matchScore: 85, summary: 'Matches perfectly.', skillGap: ['GraphQL', 'Docker'], suggestedStage: 'interview-scheduled' });
    } else if (promptText.includes('offer') || promptText.includes('salaryBenchmarking')) {
      text = JSON.stringify({
        salaryBenchmarking: { status: 'competitive', percentile: 75, marketAverage: 120000 },
        compensationRecommendations: [],
        offerQualityAnalysis: { score: 90, details: 'Excellent offer' },
        missingClauses: [],
        complianceChecks: { status: 'compliant', issues: [] },
        offerRiskAnalysis: { riskLevel: 'low', indicators: [] }
      });
    } else {
      text = JSON.stringify({ success: true, mock: true });
    }
  }

  return text;
};

/**
 * Dispatches physical provider requests (Gemini or OpenRouter).
 */
const callProvider = async (provider, model, promptText) => {
  const apiKey = provider.apiKey || (provider.name === 'openrouter' ? process.env.OPENROUTER_API_KEY : process.env.GEMINI_API_KEY) || 'mock-key';

  if (provider.name === 'gemini') {
    // Under testing or mock/placeholder key environments, execute mock responses
    if (process.env.NODE_ENV === 'test' || isMockOrPlaceholderKey(apiKey)) {
      const text = getMockResponse(promptText);
      return {
        text,
        inputTokens: Math.ceil(promptText.length / 4),
        outputTokens: Math.ceil(text.length / 4),
        durationMs: 50
      };
    }

    const start = Date.now();
    const endpoint = provider.baseUrl || 'https://generativelanguage.googleapis.com/v1beta/models';
    let response;

    try {
      response = await fetch(
        `${endpoint}/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }]
          })
        }
      );
    } catch (networkErr) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[AI Gateway] Gemini network request failed (${networkErr.message}). Falling back to mock generator.`);
        const text = getMockResponse(promptText);
        return {
          text,
          inputTokens: Math.ceil(promptText.length / 4),
          outputTokens: Math.ceil(text.length / 4),
          durationMs: 50
        };
      }
      throw new AppError(`Gemini Network Error: ${networkErr.message}`, 502);
    }

    const durationMs = Date.now() - start;

    if (!response.ok) {
      const errText = await response.text();
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[AI Gateway] Gemini call returned status ${response.status} (${errText.slice(0, 120)}). Falling back to mock generator.`);
        const text = getMockResponse(promptText);
        return {
          text,
          inputTokens: Math.ceil(promptText.length / 4),
          outputTokens: Math.ceil(text.length / 4),
          durationMs
        };
      }
      throw new AppError(`Gemini Provider Error: ${response.status} - ${errText}`, response.status);
    }

    const data = await response.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!text || !text.trim()) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[AI Gateway] Gemini returned empty response text. Falling back to mock generator in development.');
        text = getMockResponse(promptText);
      } else if (data.promptFeedback?.blockReason) {
        throw new AppError(`Gemini blocked prompt: ${data.promptFeedback.blockReason}`, 422);
      } else if (data.candidates?.[0]?.finishReason === 'SAFETY') {
        throw new AppError('Gemini response blocked by content safety filters.', 422);
      } else {
        throw new AppError('Gemini returned an empty response.', 502);
      }
    }

    const inputTokens = data.usageMetadata?.promptTokenCount || Math.ceil(promptText.length / 4);
    const outputTokens = data.usageMetadata?.candidatesTokenCount || Math.ceil(text.length / 4);

    return { text, inputTokens, outputTokens, durationMs };
  } else if (provider.name === 'openrouter') {
    const key = apiKey;

    if (process.env.NODE_ENV === 'test' || isMockOrPlaceholderKey(key)) {
      const text = getMockResponse(promptText);
      return {
        text,
        inputTokens: Math.ceil(promptText.length / 4),
        outputTokens: Math.ceil(text.length / 4),
        durationMs: 50
      };
    }

    const start = Date.now();
    let response;

    try {
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: model || 'google/gemini-2.0-flash-exp:free',
          messages: [{ role: 'user', content: promptText }]
        })
      });
    } catch (networkErr) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[AI Gateway] OpenRouter network request failed (${networkErr.message}). Falling back to mock generator.`);
        const text = getMockResponse(promptText);
        return {
          text,
          inputTokens: Math.ceil(promptText.length / 4),
          outputTokens: Math.ceil(text.length / 4),
          durationMs: 50
        };
      }
      throw new AppError(`OpenRouter Network Error: ${networkErr.message}`, 502);
    }

    const durationMs = Date.now() - start;

    if (!response.ok) {
      const errText = await response.text();
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[AI Gateway] OpenRouter call returned status ${response.status} (${errText.slice(0, 120)}). Falling back to mock generator.`);
        const text = getMockResponse(promptText);
        return {
          text,
          inputTokens: Math.ceil(promptText.length / 4),
          outputTokens: Math.ceil(text.length / 4),
          durationMs
        };
      }
      throw new AppError(`OpenRouter Provider Error: ${response.status} - ${errText}`, response.status);
    }

    const data = await response.json();
    let text = data.choices?.[0]?.message?.content || '';

    if (!text || !text.trim()) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[AI Gateway] OpenRouter returned empty response text. Falling back to mock generator in development.');
        text = getMockResponse(promptText);
      } else if (data.error) {
        throw new AppError(`OpenRouter Error: ${data.error.message || JSON.stringify(data.error)}`, 502);
      } else {
        throw new AppError('OpenRouter returned an empty response.', 502);
      }
    }

    const inputTokens = data.usage?.prompt_tokens || Math.ceil(promptText.length / 4);
    const outputTokens = data.usage?.completion_tokens || Math.ceil(text.length / 4);

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

  if (process.env.OPENROUTER_API_KEY && !isMockOrPlaceholderKey(process.env.OPENROUTER_API_KEY) && !config.primaryProviderManualOverride) {
    providerName = 'openrouter';
  }

  let activeProvider = await AIProvider.findOne({ name: providerName, isActive: true }).select('+apiKey');

  if (!activeProvider && config.fallbackProvider) {
    providerName = config.fallbackProvider;
    activeProvider = await AIProvider.findOne({ name: providerName, isActive: true }).select('+apiKey');
  }

  if (!activeProvider) {
    if (providerName === 'openrouter') {
      activeProvider = {
        name: 'openrouter',
        displayName: 'OpenRouter (Fallback)',
        isActive: true,
        costPerInputToken: 0,
        costPerOutputToken: 0
      };
    } else {
      // Setup system fallback details if DB has no configs loaded
      activeProvider = {
        name: 'gemini',
        displayName: 'Google Gemini (Fallback)',
        isActive: true,
        costPerInputToken: 0.000000075,
        costPerOutputToken: 0.0000003
      };
    }
  }

  let targetModel = config.modelMappings?.[promptKey] || config.modelMappings?.fast || (activeProvider.name === 'openrouter' ? 'google/gemini-2.0-flash-exp:free' : 'gemini-2.5-flash');


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
