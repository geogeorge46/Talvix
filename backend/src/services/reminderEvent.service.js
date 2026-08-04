import mongoose from 'mongoose';
import { DOMAIN_EVENTS } from "../constants/domainEvents.js";
import { NotificationOutbox } from "../models/NotificationOutbox.js";
import {
  domainEventKey,
  versionedEventKey,
} from "../utils/domainEventDeduplication.js";
import { publishOptionalDomainEvent } from "./domainEvent.service.js";

const schedule = (x) =>
  x.at > new Date()
    ? publishOptionalDomainEvent(
        {
          type: x.type,
          recipientIds: x.recipientIds,
          payload: x.payload,
          company: x.company,
          availableAt: x.at,
          deduplicationKey: x.key,
        },
        { session: x.session },
      )
    : null;

export const createAssessmentReminders = (a, r, session) =>
  Promise.all(
    [
      [24, "24h"],
      [1, "1h"],
    ].map(([h, l]) =>
      schedule({
        type: DOMAIN_EVENTS.ASSESSMENT_REMINDER,
        recipientIds: [String(r)],
        payload: {
          assignmentId: String(a.id),
          assessmentId: String(a.assessment),
          expiresAt: a.expiresAt,
          reminderOffset: l,
          actionUrl: `/candidate/assessments/${a.id}`,
        },
        at: new Date(a.expiresAt - h * 3600000),
        key: domainEventKey(DOMAIN_EVENTS.ASSESSMENT_REMINDER, a.id, l),
        session,
      }),
    ),
  );

export const createInterviewReminders = async (s, r, session) => {
  const CompanyModel = mongoose.model('Company');
  const comp = await CompanyModel.findById(s.company);
  const policy = comp?.interviewReminderPolicy || ['24h', '1h'];

  const offsets = policy.map(label => {
    const match = label.match(/^(\d+)(h|m)$/i);
    if (!match) return null;
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    const hours = unit === 'h' ? value : value / 60;
    return { hours, label };
  }).filter(Boolean);

  return Promise.all(
    offsets.map(({ hours, label }) =>
      schedule({
        type: DOMAIN_EVENTS.INTERVIEW_REMINDER,
        recipientIds: r.map(String),
        company: String(s.company),
        payload: {
          scheduleId: String(s.id),
          processId: String(s.process),
          scheduleVersion: s.version,
          startTime: s.startTime,
          timezone: s.timezone,
          reminderOffset: label,
          actionUrl: `/candidate/interviews/schedules/${s.id}`,
        },
        at: new Date(s.startTime - hours * 3600000),
        key: `${versionedEventKey(DOMAIN_EVENTS.INTERVIEW_REMINDER, s.id, s.version)}:${label}`,
        session,
      }),
    ),
  );
};

export const createOfferReminders = (o, session) =>
  Promise.all(
    [
      [48, "48h"],
      [24, "24h"],
    ].map(([h, l]) =>
      schedule({
        type: DOMAIN_EVENTS.OFFER_EXPIRY_REMINDER,
        recipientIds: [String(o.candidate)],
        company: String(o.company),
        payload: {
          offerId: String(o.id),
          revision: o.revision,
          expiresAt: o.expiresAt,
          reminderOffset: l,
          actionUrl: `/candidate/offers/${o.id}`,
        },
        at: new Date(o.expiresAt - h * 3600000),
        key: `${versionedEventKey(DOMAIN_EVENTS.OFFER_EXPIRY_REMINDER, o.id, o.revision, 'r')}:${l}`,
        session,
      }),
    ),
  );

export const cancelReminders = (prefix) =>
  NotificationOutbox.updateMany(
    {
      deduplicationKey: {
        $regex: `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
      },
      status: { $in: ["pending", "failed"] },
    },
    { $set: { status: "cancelled" } },
  );
