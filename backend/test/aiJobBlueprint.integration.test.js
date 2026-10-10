import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Company } from '../src/models/Company.js';
import { CompanyMember } from '../src/models/CompanyMember.js';
import { RecruiterProfile } from '../src/models/RecruiterProfile.js';
import { Job } from '../src/models/Job.js';
import { Assessment } from '../src/models/Assessment.js';
import { Question } from '../src/models/Question.js';
import { AIProvider } from '../src/models/AIProvider.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { assessmentBlueprintDataSchema } from '../src/validators/assessmentBlueprint.validator.js';
import { computeJobContentHash } from '../src/services/ai.service.js';

let replicaSet;
let sequence = 0;

const createAccount = async (role = 'recruiter', permissions = ['jobs.create', 'jobs.update', 'jobs.publish', 'assessments.manage']) => {
  sequence += 1;
  const user = await User.create({
    fullName: `Test Blueprint User ${sequence}`,
    email: `recruiter.blueprint.${sequence}@talvix.test`,
    password: 'Password123!',
    role
  });

  let company = null;
  let member = null;
  let profile = null;

  if (role === 'recruiter') {
    company = await Company.create({
      name: `Talvix Blueprint Tech ${sequence}`,
      slug: `talvix-blueprint-tech-${sequence}`,
      owner: user._id,
      industry: 'Software Engineering',
      verificationStatus: 'verified',
      isActive: true
    });

    member = await CompanyMember.create({
      recruiter: user._id,
      company: company._id,
      role: 'admin',
      permissions,
      status: 'active',
      joinedAt: new Date()
    });

    profile = await RecruiterProfile.create({
      user: user._id,
      company: company._id,
      isApproved: true,
      isCompanyOwner: true,
      permissions
    });
  }

  const token = generateAccessToken(user.id);
  return { user, company, member, profile, token };
};

describe('Talvix Stage 3C — AI Assessment Blueprint Generation Integration Tests', () => {
  beforeAll(async () => {
    replicaSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' }
    });
    await mongoose.connect(replicaSet.getUri());

    await AIProvider.create({
      provider: 'openrouter',
      name: 'OpenRouter Primary',
      displayName: 'OpenRouter Primary',
      apiKey: 'test-api-key',
      baseUrl: 'https://openrouter.ai/api/v1',
      supportedModels: ['google/gemini-2.5-flash'],
      primaryModel: 'google/gemini-2.5-flash',
      isDefault: true,
      isActive: true,
      retryCount: 1,
      retryBackoffMs: 1
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (replicaSet) await replicaSet.stop();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Deterministic Schema & Blueprint Computation', () => {
    it('validates section inputs and computes duration and marks sum deterministically', () => {
      const rawData = {
        targetSeniority: 'senior',
        sections: [
          {
            title: 'React Components & Hooks',
            questionType: 'coding',
            questionCount: 2,
            difficulty: 'hard',
            durationMinutes: 30,
            sectionMarks: 40,
            skillsEvaluated: ['React', 'TypeScript']
          },
          {
            title: 'Node.js Express System Architecture',
            questionType: 'multiple-choice',
            questionCount: 5,
            difficulty: 'medium',
            durationMinutes: 20,
            sectionMarks: 30,
            skillsEvaluated: ['Node.js', 'Express']
          }
        ]
      };

      const parsed = assessmentBlueprintDataSchema.parse(rawData);
      expect(parsed.totalDurationMinutes).toBe(50);
      expect(parsed.totalMarks).toBe(70);
      expect(parsed.targetSeniority).toBe('senior');
      expect(parsed.sections.length).toBe(2);
      expect(parsed.sections[0].id).toMatch(/^sec-/);
    });
  });

  describe('API Endpoints & Lifecycle Workflows', () => {
    it('previews blueprint generation for unpersisted job draft', async () => {
      const recruiter = await createAccount('recruiter');

      const mockAiResponse = {
        targetSeniority: 'senior',
        sections: [
          {
            title: 'Technical Coding Challenge',
            purpose: 'Evaluate async handling and state management',
            questionType: 'coding',
            questionCount: 2,
            difficulty: 'hard',
            durationMinutes: 45,
            sectionMarks: 50,
            skillsEvaluated: ['JavaScript', 'Node.js']
          }
        ],
        totalDurationMinutes: 45,
        totalMarks: 50,
        recommendedPassingPercentage: 75
      };

      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockAiResponse) } }]
        })
      });

      const res = await request(app)
        .post('/api/v1/jobs/ai/generate-blueprint')
        .set('Authorization', `Bearer ${recruiter.token}`)
        .send({
          title: 'Senior Backend Engineer',
          description: 'Build scalable Node.js microservices with MongoDB and Redis.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.blueprint.targetSeniority).toBe('senior');
      expect(res.body.data.blueprint.sections.length).toBe(1);
    });

    it('generates, persists, regenerates section, approves, and converts blueprint for a managed job', async () => {
      const recruiter = await createAccount('recruiter');

      const job = await Job.create({
        company: recruiter.company._id,
        createdBy: recruiter.user._id,
        title: 'Lead Full Stack Architect',
        slug: 'lead-full-stack-architect',
        description: 'Design and deliver resilient web applications using React, Express, and PostgreSQL.',
        employmentType: 'full-time',
        workMode: 'remote',
        skills: [
          { name: 'React', required: true, minimumProficiency: 'advanced', minimumYearsOfExperience: 3, weight: 50 },
          { name: 'Node.js', required: true, minimumProficiency: 'advanced', minimumYearsOfExperience: 3, weight: 50 }
        ]
      });

      const mockAiBlueprint = {
        targetSeniority: 'lead',
        sections: [
          {
            title: 'System Design Architecture',
            purpose: 'Assess distributed system trade-offs and scaling strategies',
            questionType: 'work-sample',
            questionCount: 1,
            difficulty: 'hard',
            durationMinutes: 40,
            sectionMarks: 50,
            skillsEvaluated: ['Node.js', 'System Architecture']
          },
          {
            title: 'Frontend Performance & React State',
            purpose: 'Evaluate web performance optimization',
            questionType: 'multiple-choice',
            questionCount: 5,
            difficulty: 'medium',
            durationMinutes: 20,
            sectionMarks: 30,
            skillsEvaluated: ['React']
          }
        ],
        recommendedPassingPercentage: 80
      };

      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockAiBlueprint) } }]
        })
      });

      // 1. Generate Blueprint
      const genRes = await request(app)
        .post(`/api/v1/jobs/manage/${job._id}/blueprint/generate`)
        .set('Authorization', `Bearer ${recruiter.token}`)
        .send({});

      expect(genRes.status).toBe(200);
      expect(genRes.body.data.blueprint.status).toBe('proposed');
      expect(genRes.body.data.blueprint.data.sections.length).toBe(2);

      const targetSectionId = genRes.body.data.blueprint.data.sections[0].id;

      // 2. Regenerate Section
      const mockRegenSection = {
        title: 'Microservices & Distributed Design',
        purpose: 'Regenerated section focusing on resilience and queuing',
        questionType: 'coding',
        questionCount: 2,
        difficulty: 'hard',
        durationMinutes: 45,
        sectionMarks: 60,
        skillsEvaluated: ['Node.js', 'Queues']
      };

      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockRegenSection) } }]
        })
      });

      const regenRes = await request(app)
        .post(`/api/v1/jobs/manage/${job._id}/blueprint/regenerate-section`)
        .set('Authorization', `Bearer ${recruiter.token}`)
        .send({
          sectionId: targetSectionId,
          customInstructions: 'Focus heavily on message queue error handling.'
        });

      expect(regenRes.status).toBe(200);
      expect(regenRes.body.data.blueprint.data.sections[0].title).toBe('Microservices & Distributed Design');

      // 3. Approve Blueprint
      const approveRes = await request(app)
        .post(`/api/v1/jobs/manage/${job._id}/blueprint/approve`)
        .set('Authorization', `Bearer ${recruiter.token}`)
        .send({});

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.blueprint.status).toBe('approved');

      // 4. Convert Blueprint into official Assessment and Questions
      const convertRes = await request(app)
        .post(`/api/v1/jobs/manage/${job._id}/blueprint/convert`)
        .set('Authorization', `Bearer ${recruiter.token}`)
        .send({});

      expect(convertRes.status).toBe(200);
      expect(convertRes.body.data.assessmentId).toBeDefined();
      expect(convertRes.body.data.blueprint.status).toBe('converted');

      // Verify records in MongoDB
      const createdAssessment = await Assessment.findById(convertRes.body.data.assessmentId);
      expect(createdAssessment).not.toBeNull();
      expect(createdAssessment.title).toBe('Lead Full Stack Architect Assessment Blueprint');
      expect(createdAssessment.status).toBe('draft');
      expect(createdAssessment.questions.length).toBeGreaterThan(0);

      const createdQuestions = await Question.find({ company: recruiter.company._id });
      expect(createdQuestions.length).toBeGreaterThan(0);
    });

    it('marks blueprint stale when job content changes', async () => {
      const recruiter = await createAccount('recruiter');

      const job = await Job.create({
        company: recruiter.company._id,
        createdBy: recruiter.user._id,
        title: 'QA Automation Engineer',
        slug: 'qa-automation-engineer',
        employmentType: 'full-time',
        workMode: 'hybrid',
        description: 'Automate E2E test suites with Cypress and Playwright.',
        blueprint: {
          schemaVersion: 1,
          promptVersion: 1,
          status: 'approved',
          contentHash: computeJobContentHash('QA Automation Engineer', 'Automate E2E test suites with Cypress and Playwright.'),
          data: {
            targetSeniority: 'mid',
            sections: [
              {
                id: 'sec-qa-1',
                title: 'E2E Testing Challenge',
                questionType: 'work-sample',
                questionCount: 1,
                durationMinutes: 30,
                sectionMarks: 50
              }
            ]
          }
        }
      });

      // Update job description
      await request(app)
        .patch(`/api/v1/jobs/manage/${job._id}`)
        .set('Authorization', `Bearer ${recruiter.token}`)
        .send({
          description: 'Updated job description requiring Selenium and Appium performance testing.'
        });

      // Fetch blueprint
      const res = await request(app)
        .get(`/api/v1/jobs/manage/${job._id}/blueprint`)
        .set('Authorization', `Bearer ${recruiter.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.blueprint.status).toBe('stale');
    });

    it('enforces multi-tenant isolation (404 on cross-company blueprint request)', async () => {
      const recruiterA = await createAccount('recruiter');
      const recruiterB = await createAccount('recruiter');

      const jobA = await Job.create({
        company: recruiterA.company._id,
        createdBy: recruiterA.user._id,
        title: 'Backend Developer A',
        slug: 'backend-developer-a',
        employmentType: 'full-time',
        workMode: 'remote',
        description: 'Python FastAPI services.'
      });


      const res = await request(app)
        .get(`/api/v1/jobs/manage/${jobA._id}/blueprint`)
        .set('Authorization', `Bearer ${recruiterB.token}`);

      expect(res.status).toBe(404);
    });
  });
});
