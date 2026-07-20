import { pathToFileURL } from 'node:url';
import mongoose from 'mongoose';

import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { env } from '../config/env.js';
import { APPLICATION_STATUSES } from '../constants/application.js';
import { OWNER_PERMISSIONS } from '../constants/permissions.js';
import { Application } from '../models/Application.js';
import { Assessment } from '../models/Assessment.js';
import { AssessmentAssignment } from '../models/AssessmentAssignment.js';
import { CandidateProfile } from '../models/CandidateProfile.js';
import { Company } from '../models/Company.js';
import { Job } from '../models/Job.js';
import { Notification } from '../models/Notification.js';
import { Question } from '../models/Question.js';
import { RecruiterProfile } from '../models/RecruiterProfile.js';
import { User } from '../models/User.js';
import { InterviewProcess } from '../models/InterviewProcess.js';
import { InterviewRound } from '../models/InterviewRound.js';
import { InterviewSchedule } from '../models/InterviewSchedule.js';
import { Offer } from '../models/Offer.js';
import { seedNotificationTemplates } from './seedNotificationTemplates.js';
import { verifyPassword } from '../utils/password.js';

// Block execution when NODE_ENV is production
if (process.env.NODE_ENV === 'production') {
  console.error('Execution blocked: Seeding is not allowed in production!');
  process.exit(1);
}

const PASSWORD = Object.freeze({
  admin: 'Admin@12345',
  recruiter: 'Recruiter@12345',
  candidate: 'Candidate@12345',
});

const credentials = Object.freeze({
  admin: { fullName: 'Talvix Admin', email: 'admin@talvix.local', password: PASSWORD.admin },
  recruiter: { fullName: 'Talvix Approved Recruiter', email: 'recruiter@talvix.local', password: PASSWORD.recruiter },
  candidate: { fullName: 'Cameron Candidate', email: 'candidate@talvix.local', password: PASSWORD.candidate },
});

const userDefinitions = [
  { fullName: 'Talvix Admin', email: 'admin@talvix.local', role: 'admin', password: PASSWORD.admin },
  { fullName: 'Talvix Approved Recruiter', email: 'recruiter@talvix.local', role: 'recruiter', password: PASSWORD.recruiter },
  { fullName: 'Talvix Pending Recruiter', email: 'recruiter-pending@talvix.local', role: 'recruiter', password: PASSWORD.recruiter },
  { fullName: 'Cameron Candidate', email: 'candidate@talvix.local', role: 'candidate', password: PASSWORD.candidate },
  { fullName: 'John Doe Candidate', email: 'candidate2@talvix.local', role: 'candidate', password: PASSWORD.candidate },
  { fullName: 'Jane Smith Candidate', email: 'candidate3@talvix.local', role: 'candidate', password: PASSWORD.candidate },
  { fullName: 'Alice Johnson Candidate', email: 'candidate4@talvix.local', role: 'candidate', password: PASSWORD.candidate },
  { fullName: 'Bob Brown Candidate', email: 'candidate5@talvix.local', role: 'candidate', password: PASSWORD.candidate },
];

const demoInventory = async () => {
  const [users, companies, jobs, applications, assessments, interviews, offers, notifications] =
    await Promise.all([
      User.countDocuments({ email: { $in: userDefinitions.map(({ email }) => email) } }),
      Company.countDocuments({ slug: { $in: ['talvix-labs', 'startup-labs'] } }),
      Job.countDocuments({
        slug: { $in: ['senior-backend-developer', 'frontend-developer', 'ui-ux-designer'] },
      }),
      Application.countDocuments({ applicationNumber: /^TLVX-DEMO-/ }),
      Assessment.countDocuments({ title: 'JavaScript Screening Assessment' }),
      InterviewProcess.countDocuments({ 'templateSnapshot.name': 'Engineering General Template' }),
      Offer.countDocuments({ offerNumber: 'TLVX-OFFER-0001' }),
      Notification.countDocuments({ deduplicationKey: /^demo-seed-notification-/ }),
    ]);
  return { users, companies, jobs, applications, assessments, interviews, offers, notifications };
};

const upsertDemoUser = async ({ fullName, email, role, password }) => {
  let user = await User.findOne({ email }).select('+password +isActive');
  if (!user) {
    user = new User({ fullName, email, role, password });
    user.isVerified = true;
    user.isActive = true;
    user.profileCompleted = true;
    await user.save();
    return { user, created: true };
  }

  if (user.role !== role || !(await verifyPassword(password, user.password))) {
    throw new Error(
      `Refusing to overwrite existing account ${email}. Use a clean local database or choose different demo credentials.`,
    );
  }

  return { user, created: false };
};

const upsertCandidateProfile = async (user, index) => {
  return CandidateProfile.findOneAndUpdate(
    { user: user._id },
    {
      $set: {
        headline: `Software Engineer - Level ${index + 1}`,
        bio: `Local demo candidate profile for ${user.fullName}.`,
        location: { city: 'Bengaluru', state: 'Karnataka', country: 'India' },
        skills: [
          { name: 'JavaScript', proficiency: 'advanced', yearsOfExperience: 4 },
          { name: 'React', proficiency: 'advanced', yearsOfExperience: 3 },
          { name: 'Node.js', proficiency: 'intermediate', yearsOfExperience: 3 },
        ],
        preferredRoles: ['Full Stack Engineer'],
        preferredJobTypes: ['full-time'],
        availability: 'immediately',
        profileVisibility: 'recruiters-only',
        profileCompletion: 90,
      },
    },
    { upsert: true, new: true, runValidators: true }
  );
};

const seedJobs = async (company, recruiter, admin) => {
  const jobDefinitions = [
    { title: 'Senior Backend Developer', slug: 'senior-backend-developer', status: 'published' },
    { title: 'Frontend Developer', slug: 'frontend-developer', status: 'pending-review' },
    { title: 'UI/UX Designer', slug: 'ui-ux-designer', status: 'draft' },
  ];

  return Promise.all(
    jobDefinitions.map((definition) => {
      const isPublished = definition.status === 'published';
      return Job.findOneAndUpdate(
        { company: company._id, slug: definition.slug },
        {
          $set: {
            title: definition.title,
            slug: definition.slug,
            status: definition.status,
            createdBy: recruiter._id,
            description: `${definition.title} demo role for local Talvix workflow testing.`,
            responsibilities: ['Build accessible product features', 'Collaborate with the Talvix demo team'],
            requirements: ['Clear communication', 'Relevant hands-on experience'],
            skills: [
              { name: 'JavaScript', required: true, minimumProficiency: 'intermediate', minimumYearsOfExperience: 2, weight: 100 },
            ],
            employmentType: 'full-time',
            workMode: 'remote',
            location: { city: 'Bengaluru', state: 'Karnataka', country: 'India' },
            salary: { minimum: 1200000, maximum: 2400000, currency: 'INR', period: 'yearly', isVisible: true },
            minimumExperience: 3,
            openings: 1,
            applicationDeadline: new Date('2028-12-31T23:59:59.000Z'),
            resumeRequired: true,
            minimumProfileCompletion: 50,
            reviewedBy: isPublished ? admin._id : null,
            reviewedAt: isPublished ? new Date() : null,
            publishedAt: isPublished ? new Date() : null,
          },
        },
        { upsert: true, new: true, runValidators: true }
      );
    })
  );
};

const seedApplications = async ({ job, company, candidates, profiles, recruiter }) => {
  const stages = ['submitted', 'under-review', 'assessment-pending', 'interview-scheduled', 'offer-sent'];

  return Promise.all(
    candidates.map((candidate, index) => {
      const status = stages[index];
      const profile = profiles[index];
      const history = APPLICATION_STATUSES.slice(0, APPLICATION_STATUSES.indexOf(status) + 1)
        .filter((value) => ['submitted', 'under-review', 'shortlisted', 'assessment-pending', 'interview-scheduled', 'offer-sent'].includes(value))
        .map((to, historyIndex, values) => ({
          from: historyIndex ? values[historyIndex - 1] : undefined,
          to,
          changedBy: recruiter._id,
          changedAt: new Date(),
        }));

      return Application.findOneAndUpdate(
        { candidate: candidate._id, job: job._id },
        {
          $set: {
            candidateProfile: profile._id,
            company: company._id,
            applicationNumber: `TLVX-DEMO-00${index + 1}`,
            status,
            coverLetter: `Demo application for ${job.title} by ${candidate.fullName}.`,
            candidateSnapshot: {
              fullName: candidate.fullName,
              headline: profile.headline,
              skills: ['JavaScript', 'React', 'Node.js'],
            },
            jobSnapshot: {
              title: job.title,
              companyName: company.name,
              employmentType: job.employmentType,
              workMode: job.workMode,
            },
            skillMatch: {
              score: 85,
              matchedSkills: ['JavaScript'],
              missingRequiredSkills: [],
              breakdown: [],
            },
            assignedRecruiters: [recruiter._id],
            tags: ['demo', 'sample'],
            statusHistory: history,
          },
        },
        { upsert: true, new: true, runValidators: true }
      );
    })
  );
};

const seedAssessments = async ({ company, recruiter, candidate, application }) => {
  const question = await Question.findOneAndUpdate(
    { company: company._id, title: 'Demo JavaScript Scope' },
    {
      $set: {
        createdBy: recruiter._id,
        title: 'Demo JavaScript Scope',
        type: 'single-choice',
        prompt: 'Which keyword declares a block-scoped variable?',
        skills: ['JavaScript'],
        difficulty: 'easy',
        defaultMarks: 10,
        options: [
          { id: 'a', text: 'let' },
          { id: 'b', text: 'var' },
        ],
        correctAnswer: 'a',
        explanation: 'let is block scoped.',
        isActive: true,
      },
    },
    { upsert: true, new: true, runValidators: true }
  );

  const assessment = await Assessment.findOneAndUpdate(
    { company: company._id, title: 'JavaScript Screening Assessment' },
    {
      $set: {
        createdBy: recruiter._id,
        type: 'technical',
        description: 'Demo JavaScript Screening Assessment.',
        instructions: 'Complete within 30 minutes.',
        skills: ['JavaScript'],
        durationMinutes: 30,
        passingPercentage: 60,
        maximumAttempts: 1,
        status: 'published',
        questions: [{ question: question._id, marks: 10, order: 0, isRequired: true }],
        totalMarks: 10,
        publishedAt: new Date(),
      },
    },
    { upsert: true, new: true, runValidators: true }
  );

  const assignment = await AssessmentAssignment.findOneAndUpdate(
    { assessment: assessment._id, application: application._id },
    {
      $set: {
        assessmentVersion: assessment.version,
        assessmentSnapshot: {
          title: assessment.title,
          description: assessment.description,
          instructions: assessment.instructions,
          durationMinutes: assessment.durationMinutes,
          totalMarks: assessment.totalMarks,
          passingPercentage: assessment.passingPercentage,
          maximumAttempts: assessment.maximumAttempts,
          shuffleQuestions: false,
          shuffleOptions: false,
          showResultImmediately: false,
          allowBackNavigation: true,
          negativeMarking: false,
          negativeMarkValue: 0,
          attachments: {
            enabled: false,
            maximumFiles: 0,
            maximumFileBytes: 10 * 1024 * 1024,
            maximumTotalBytes: 20 * 1024 * 1024,
            allowedMimeTypes: [],
          },
          questions: [
            {
              questionId: question._id,
              marks: 10,
              order: 0,
              isRequired: true,
              type: question.type,
              title: question.title,
              prompt: question.prompt,
              options: question.options,
              correctAnswer: 'a',
              explanation: 'let is block scoped.',
              skills: question.skills,
            },
          ],
        },
        candidate: candidate._id,
        company: company._id,
        assignedBy: recruiter._id,
        status: 'available',
        availableFrom: new Date(Date.now() - 3600000),
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    },
    { upsert: true, new: true, runValidators: true }
  );

  return { assessment, assignment };
};

const seedInterviews = async ({ company, recruiter, candidate, application, job }) => {
  const process = await InterviewProcess.findOneAndUpdate(
    { application: application._id },
    {
      $set: {
        candidate: candidate._id,
        job: job._id,
        company: company._id,
        createdBy: recruiter._id,
        templateSnapshot: {
          name: 'Engineering General Template',
          rounds: [
            {
              name: 'Technical Interview',
              type: 'technical',
              durationMinutes: 45,
              order: 0,
              required: true,
              scorecardTemplate: {
                criteria: [
                  { id: 'js', name: 'JavaScript Skills', category: 'technical', weight: 1, maximumScore: 10, required: true },
                ],
              },
            },
          ],
        },
        status: 'active',
        currentRoundOrder: 0,
        overallRecommendation: 'pending',
      },
    },
    { upsert: true, new: true, runValidators: true }
  );

  const round = await InterviewRound.findOneAndUpdate(
    { process: process._id, order: 0 },
    {
      $set: {
        application: application._id,
        candidate: candidate._id,
        job: job._id,
        company: company._id,
        name: 'Technical Interview',
        type: 'technical',
        required: true,
        durationMinutes: 45,
        status: 'scheduled',
        interviewers: [recruiter._id],
        scorecardTemplate: {
          criteria: [
            { id: 'js', name: 'JavaScript Skills', category: 'technical', weight: 1, maximumScore: 10, required: true },
          ],
        },
      },
    },
    { upsert: true, new: true, runValidators: true }
  );

  process.rounds = [round._id];
  process.currentRound = round._id;
  await process.save();

  const schedule = await InterviewSchedule.findOneAndUpdate(
    { round: round._id },
    {
      $set: {
        process: process._id,
        application: application._id,
        candidate: candidate._id,
        job: job._id,
        company: company._id,
        scheduledBy: recruiter._id,
        interviewers: [recruiter._id],
        timezone: 'Asia/Kolkata',
        startTime: new Date(Date.now() + 86400000), // tomorrow
        endTime: new Date(Date.now() + 86400000 + 45 * 60000),
        durationMinutes: 45,
        mode: 'video',
        meetingProvider: 'google-meet',
        meetingUrl: 'https://meet.google.com/abc-defg-hij',
        meetingId: 'abc-defg-hij',
        status: 'confirmed',
        candidateResponse: 'accepted',
        candidateResponseAt: new Date(),
      },
    },
    { upsert: true, new: true, runValidators: true }
  );

  round.scheduledInterview = schedule._id;
  await round.save();

  return { process, round, schedule };
};

const seedOffers = async ({ company, recruiter, candidate, application, job, candidateProfile }) => {
  const offerNumber = 'TLVX-OFFER-0001';
  const chainId = new mongoose.Types.ObjectId();

  const offer = await Offer.findOneAndUpdate(
    { offerNumber },
    {
      $set: {
        chainId,
        company: company._id,
        job: job._id,
        application: application._id,
        candidate: candidate._id,
        candidateProfile: candidateProfile._id,
        createdBy: recruiter._id,
        title: job.title,
        department: 'Engineering',
        employmentType: 'full-time',
        workMode: 'remote',
        location: { city: 'Bengaluru', state: 'Karnataka', country: 'India' },
        joiningDate: new Date(Date.now() + 30 * 86400000),
        reportingTo: { name: recruiter.fullName, designation: 'Talent Lead' },
        compensation: {
          currency: 'INR',
          period: 'yearly',
          base: 1500000,
          variable: 100000,
          bonus: 50000,
          joiningBonus: 50000,
          estimatedTotal: 1700000,
        },
        benefits: ['Medical Insurance', 'Learning Budget'],
        terms: ['Standard employment terms apply.'],
        clauses: [
          { title: 'Confidentiality', content: 'You must maintain confidentiality of all business operations.', order: 0 },
        ],
        status: 'sent',
        sentAt: new Date(),
        sentBy: recruiter._id,
        candidateSnapshot: {
          fullName: candidate.fullName,
          headline: candidateProfile.headline,
        },
        jobSnapshot: {
          title: job.title,
          companyName: company.name,
          employmentType: job.employmentType,
          workMode: job.workMode,
        },
      },
    },
    { upsert: true, new: true, runValidators: true }
  );

  return offer;
};

const seedNotifications = async ({ admin, recruiter, pendingRecruiter, candidates, company, jobs }) => {
  const samples = [
    { recipient: admin, recipientRole: 'admin', type: 'job-submitted', category: 'job', title: 'Demo job awaiting review', message: 'Frontend Developer is ready for review.', source: 'job', entity: jobs[1] },
    { recipient: recruiter, recipientRole: 'recruiter', type: 'job-approved', category: 'job', title: 'Demo job approved', message: 'Senior Backend Developer has been approved.', source: 'job', entity: jobs[0] },
    { recipient: pendingRecruiter, recipientRole: 'recruiter', type: 'document-verification-requested', category: 'company', title: 'Company registration pending', message: 'Startup Labs is awaiting verification.', source: 'company', entity: null },
    { recipient: candidates[0], recipientRole: 'candidate', type: 'assessment-assigned', category: 'assessment', title: 'Demo assessment assigned', message: 'A JavaScript screening assessment is available.', source: 'assessment', entity: null },
  ];

  await Promise.all(
    samples.map(({ recipient, entity, ...sample }, index) => {
      return Notification.findOneAndUpdate(
        { deduplicationKey: `demo-seed-notification-${index + 1}` },
        {
          $set: {
            ...sample,
            recipient: recipient._id,
            company: company._id,
            channels: ['in-app'],
            read: false,
            sourceEntity: entity ? { model: 'Job', id: entity._id } : undefined,
          },
        },
        { upsert: true, new: true, runValidators: true }
      );
    })
  );
};

export const seedDemo = async () => {
  const before = await demoInventory();
  // Ensure notification templates are seeded first
  await seedNotificationTemplates();

  // Create users
  const userResults = await Promise.all(userDefinitions.map(upsertDemoUser));
  const seededUsers = userResults.map(({ user }) => user);
  const admin = seededUsers.find(u => u.email === 'admin@talvix.local');
  const recruiter = seededUsers.find(u => u.email === 'recruiter@talvix.local');
  const recruiterPending = seededUsers.find(u => u.email === 'recruiter-pending@talvix.local');
  const candidatesList = seededUsers.filter(u => u.role === 'candidate');

  // Create companies
  const companyVerified = await Company.findOneAndUpdate(
    { slug: 'talvix-labs' },
    {
      $set: {
        name: 'Talvix Labs',
        description: 'Local-only verified demo company.',
        industry: 'Software',
        companySize: '51-200',
        headquarters: { city: 'Bengaluru', state: 'Karnataka', country: 'India' },
        verificationStatus: 'verified',
        verifiedBy: admin._id,
        verifiedAt: new Date(),
        owner: recruiter._id,
        teamMembers: [{ recruiter: recruiter._id, role: 'Owner', permissions: OWNER_PERMISSIONS, status: 'active' }],
        isActive: true,
      },
    },
    { upsert: true, new: true, runValidators: true }
  );

  const companyPending = await Company.findOneAndUpdate(
    { slug: 'startup-labs' },
    {
      $set: {
        name: 'Startup Labs',
        description: 'Pending verification startup.',
        industry: 'Software',
        companySize: '1-10',
        headquarters: { city: 'Mumbai', state: 'Maharashtra', country: 'India' },
        verificationStatus: 'pending',
        owner: recruiterPending._id,
        teamMembers: [{ recruiter: recruiterPending._id, role: 'Owner', permissions: [], status: 'active' }],
        isActive: true,
      },
    },
    { upsert: true, new: true, runValidators: true }
  );

  // Recruiter Profiles
  await RecruiterProfile.findOneAndUpdate(
    { user: recruiter._id },
    { $set: { company: companyVerified._id, designation: 'Talent Lead', department: 'People', isCompanyOwner: true, permissions: OWNER_PERMISSIONS, isApproved: true, approvedBy: admin._id, approvedAt: new Date() } },
    { upsert: true, new: true, runValidators: true }
  );

  await RecruiterProfile.findOneAndUpdate(
    { user: recruiterPending._id },
    { $set: { company: companyPending._id, designation: 'Founder', department: 'Executive', isCompanyOwner: true, permissions: [], isApproved: false } },
    { upsert: true, new: true, runValidators: true }
  );

  // Candidate Profiles
  const candidateProfiles = await Promise.all(candidatesList.map((c, i) => upsertCandidateProfile(c, i)));

  // Seed Jobs
  const jobs = await seedJobs(companyVerified, recruiter, admin);

  // Seed Applications
  const applications = await seedApplications({
    job: jobs[0], // Senior Backend Developer (published)
    company: companyVerified,
    candidates: candidatesList,
    profiles: candidateProfiles,
    recruiter,
  });

  // Seed Assessments & Assignments for Candidate 3 (Application index 2: assessment-pending)
  await seedAssessments({
    company: companyVerified,
    recruiter,
    candidate: candidatesList[2],
    application: applications[2],
  });

  // Seed Interviews for Candidate 4 (Application index 3: interview-scheduled)
  await seedInterviews({
    company: companyVerified,
    recruiter,
    candidate: candidatesList[3],
    application: applications[3],
    job: jobs[0],
  });

  // Seed Offers for Candidate 5 (Application index 4: offer-sent)
  await seedOffers({
    company: companyVerified,
    recruiter,
    candidate: candidatesList[4],
    application: applications[4],
    job: jobs[0],
    candidateProfile: candidateProfiles[4],
  });

  // Seed Notifications
  await seedNotifications({
    admin,
    recruiter,
    pendingRecruiter: recruiterPending,
    candidates: candidatesList,
    company: companyVerified,
    jobs,
  });

  const after = await demoInventory();
  const records = Object.fromEntries(
    Object.entries(after).map(([name, total]) => [
      name,
      { created: total - before[name], reused: before[name], total },
    ]),
  );

  return {
    users: {
      created: userResults.filter(({ created }) => created).length,
      reused: userResults.filter(({ created }) => !created).length,
      total: seededUsers.length,
    },
    records,
  };
};

const printSummary = (result) => {
  console.info('\n==================================================');
  console.info(' Talvix Demo Seeding Completed Successfully');
  console.info('==================================================');
  console.info('Created or safely reused records:');
  console.info(` - Users: ${result.users.total} (${result.users.created} created, ${result.users.reused} reused; 1 Admin, 2 Recruiters, 5 Candidates)`);
  const recordSummary = (name) =>
    `${result.records[name].total} (${result.records[name].created} created, ${result.records[name].reused} reused)`;
  console.info(` - Companies: ${recordSummary('companies')} — 1 Verified, 1 Pending`);
  console.info(` - Jobs: ${recordSummary('jobs')} — Published, Pending Review, Draft`);
  console.info(` - Applications: ${recordSummary('applications')} — five pipeline stages`);
  console.info(` - Assessments: ${recordSummary('assessments')}`);
  console.info(` - Interviews: ${recordSummary('interviews')}`);
  console.info(` - Offers: ${recordSummary('offers')}`);
  console.info(` - Notifications: ${recordSummary('notifications')}`);
  console.info('\nDemo Credentials (Local Development Only):');
  console.info(`\nAdmin:`);
  console.info(` Email: ${credentials.admin.email}`);
  console.info(` Password: ${credentials.admin.password}`);
  console.info(`\nRecruiter:`);
  console.info(` Email: ${credentials.recruiter.email}`);
  console.info(` Password: ${credentials.recruiter.password}`);
  console.info(`\nCandidate:`);
  console.info(` Email: ${credentials.candidate.email}`);
  console.info(` Password: ${credentials.candidate.password}`);
  console.info('\nURLs:');
  console.info(` - Admin Login:     ${env.APP_FRONTEND_URL}/login`);
  console.info(` - Recruiter Login: ${env.APP_FRONTEND_URL}/login`);
  console.info(` - Candidate Login: ${env.APP_FRONTEND_URL}/login`);
  console.info(` - Frontend URL:     ${env.APP_FRONTEND_URL}`);
  console.info(` - Backend URL:      http://localhost:${env.PORT}`);
  console.info(` - Health-check URL: http://localhost:${env.PORT}/api/v1/health`);
  console.info('==================================================\n');
};

const run = async () => {
  try {
    await connectDatabase();
    const result = await seedDemo();
    printSummary(result);
  } finally {
    await disconnectDatabase();
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(`\nDemo seed failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
