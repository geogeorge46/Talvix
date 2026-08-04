import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { z } from "zod";
import {
  CANDIDATE_RESPONSES,
  CRITERION_CATEGORIES,
  INTERVIEW_MODES,
  INTERVIEW_TYPES,
  MEETING_PROVIDERS,
  PROCESS_STATUSES,
  RECOMMENDATIONS,
  ROUND_STATUSES,
  SCHEDULE_STATUSES,
} from "../constants/interview.js";
const oid = z
  .string()
  .refine(mongoose.isObjectIdOrHexString, "Invalid MongoDB ObjectId");
const text = (max) => z.string().trim().max(max);
const page = {
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
};
const zone = z.string().refine((v) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: v });
    return true;
  } catch {
    return false;
  }
}, "Invalid IANA timezone");
const criterion = z
  .object({
    id: z.string().optional(),
    name: text(200).min(1),
    description: text(2000).optional(),
    category: z.enum(CRITERION_CATEGORIES),
    weight: z.number().positive(),
    maximumScore: z.number().int().min(1).max(10),
    required: z.boolean().default(true),
  })
  .strict()
  .transform((v) => ({ ...v, id: v.id ?? randomUUID() }));
const round = z
  .object({
    name: text(200).min(1),
    description: text(3000).optional(),
    type: z.enum(INTERVIEW_TYPES),
    durationMinutes: z.number().int().min(10).max(480),
    order: z.number().int().nonnegative(),
    required: z.boolean().default(true),
    scorecardTemplate: z
      .object({ criteria: z.array(criterion).min(1).max(30) })
      .strict(),
    defaultInterviewers: z.array(oid).max(20).default([]),
    minimumInterviewers: z.number().int().min(1).default(1),
    maximumInterviewers: z.number().int().min(1).max(20).default(1),
  })
  .strict()
  .refine((v) => v.maximumInterviewers >= v.minimumInterviewers, {
    message: "Maximum interviewers cannot be lower than minimum",
  });
export const templateBody = z
  .object({
    name: text(200).min(1),
    description: text(3000).optional(),
    job: oid.optional(),
    rounds: z.array(round).min(1).max(20),
    isReusable: z.boolean().default(true),
  })
  .strict()
  .superRefine((v, c) => {
    if (new Set(v.rounds.map((x) => x.order)).size !== v.rounds.length)
      c.addIssue({
        code: "custom",
        path: ["rounds"],
        message: "Round order must be unique",
      });
    for (const [i, r] of v.rounds.entries())
      if (
        new Set(r.scorecardTemplate.criteria.map((x) => x.id)).size !==
        r.scorecardTemplate.criteria.length
      )
        c.addIssue({
          code: "custom",
          path: ["rounds", i, "scorecardTemplate"],
          message: "Criterion IDs must be unique",
        });
  });
export const templateUpdate = z.union([
  templateBody,
  z
    .object({
      name: text(200).min(1).optional(),
      description: text(3000).optional(),
      isReusable: z.boolean().optional(),
    })
    .strict(),
]);
export const templateParams = z.object({ templateId: oid }).strict();
export const processParams = z.object({ processId: oid }).strict();
export const roundParams = z.object({ processId: oid, roundId: oid }).strict();
export const scheduleParams = z.object({ scheduleId: oid }).strict();
export const feedbackParams = z.object({ roundId: oid }).strict();
export const availabilityParams = z.object({ availabilityId: oid }).strict();
export const processBody = z
  .object({
    applicationId: oid,
    templateId: oid.optional(),
    rounds: z.array(round).min(1).max(20).optional(),
  })
  .strict()
  .refine((v) => Boolean(v.templateId) !== Boolean(v.rounds), {
    message: "Provide either templateId or custom rounds",
  });
export const listQuery = z
  .object({
    ...page,
    search: text(100).optional(),
    jobId: oid.optional(),
    active: z.enum(["true", "false"]).optional(),
    reusable: z.enum(["true", "false"]).optional(),
    type: z.enum(INTERVIEW_TYPES).optional(),
    status: z.enum(PROCESS_STATUSES).optional(),
    candidate: oid.optional(),
    applicationId: oid.optional(),
    sort: z
      .enum([
        "newest",
        "oldest",
        "name",
        "usage-high",
        "usage-low",
        "candidate-name",
        "next-interview",
        "score-high",
        "score-low",
      ])
      .default("newest"),
  })
  .strict();
const scheduleBase = {
  interviewerIds: z.array(oid).min(1).max(20),
  timezone: zone,
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  mode: z.enum(INTERVIEW_MODES),
  meetingProvider: z.enum(MEETING_PROVIDERS),
  meetingUrl: z
    .string()
    .url()
    .refine((v) => v.startsWith("https://"))
    .optional(),
  phoneDetails: z
    .object({ phoneNumber: text(50).min(5), extension: text(20).optional() })
    .strict()
    .optional(),
  location: z
    .object({
      name: text(200).min(1),
      address: text(500).min(1),
      city: text(100).optional(),
      state: text(100).optional(),
      country: text(100).optional(),
      instructions: text(1000).optional(),
    })
    .strict()
    .optional(),
  candidateInstructions: text(3000).optional(),
  interviewerInstructions: text(3000).optional(),
  overrideConflicts: z.boolean().optional(),
};
const validateSchedule = (v, c) => {
  if (v.endTime <= v.startTime)
    c.addIssue({
      code: "custom",
      path: ["endTime"],
      message: "End must follow start",
    });
  if (v.mode === "video" && !v.meetingUrl && v.meetingProvider === "custom")
    c.addIssue({
      code: "custom",
      path: ["meetingUrl"],
      message: "HTTPS meeting URL is required",
    });
  if (v.mode === "phone" && !v.phoneDetails)
    c.addIssue({
      code: "custom",
      path: ["phoneDetails"],
      message: "Phone details are required",
    });
  if (v.mode === "onsite" && !v.location)
    c.addIssue({
      code: "custom",
      path: ["location"],
      message: "Location is required",
    });
};
export const scheduleBody = z
  .object(scheduleBase)
  .strict()
  .superRefine(validateSchedule);
export const rescheduleBody = z
  .object({
    ...scheduleBase,
    interviewerIds: z.array(oid).min(1).max(20).optional(),
    reason: text(2000).min(1),
  })
  .strict()
  .superRefine(validateSchedule);
const slot = z
  .object({ startTime: z.coerce.date(), endTime: z.coerce.date() })
  .strict()
  .refine((v) => v.endTime > v.startTime);
export const responseBody = z
  .object({
    response: z.enum(CANDIDATE_RESPONSES.filter((v) => v !== "pending")),
    reason: text(2000).optional(),
    preferredSlots: z.array(slot).max(5).optional(),
  })
  .strict();
export const reasonBody = z.object({ reason: text(2000).min(1) }).strict();
export const noShowBody = z
  .object({
    party: z.enum(["candidate", "interviewer", "both"]),
    reason: text(2000).min(1),
  })
  .strict();
export const feedbackBody = z
  .object({
    scores: z
      .array(
        z
          .object({
            criterionId: z.string().min(1),
            score: z.number().min(0).max(10),
            comment: text(2000).optional(),
          })
          .strict(),
      )
      .max(30),
    recommendation: z.enum(RECOMMENDATIONS),
    strengths: z.array(text(500)).max(20).default([]),
    concerns: z.array(text(500)).max(20).default([]),
    privateNotes: text(5000).optional(),
    candidateVisibleFeedback: text(3000).optional(),
    attachments: z.array(oid).max(10).optional(),
  })
  .strict();
export const finalizeBody = z
  .object({
    recommendation: z.enum(RECOMMENDATIONS),
    reason: text(2000).min(1),
  })
  .strict();
export const availabilityBody = z
  .object({
    timezone: zone,
    date: z.coerce.date(),
    slots: z.array(slot).min(1).max(20),
  })
  .strict()
  .superRefine((v, c) => {
    const s = [...v.slots].sort((a, b) => a.startTime - b.startTime);
    if (s.some((x, i) => i && s[i - 1].endTime > x.startTime))
      c.addIssue({
        code: "custom",
        path: ["slots"],
        message: "Availability slots cannot overlap",
      });
  });
export const availabilityQuery = z
  .object({
    ...page,
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .strict();
export const statusBody = z
  .object({
    status: z.union([
      z.enum(PROCESS_STATUSES),
      z.enum(ROUND_STATUSES),
      z.enum(SCHEDULE_STATUSES),
    ]),
    reason: text(2000).min(1),
  })
  .strict();
export const roundIdParams = z.object({ roundId: oid }).strict();
export const feedbackIdParams = z.object({ feedbackId: oid }).strict();
export const calendarQuery = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
    interviewerId: oid.optional(),
    jobId: oid.optional(),
    status: z.enum(SCHEDULE_STATUSES).optional(),
  })
  .strict()
  .refine((v) => v.to > v.from && v.to - v.from <= 90 * 86400000, {
    message: "Calendar range must be between 1 and 90 days",
  });
