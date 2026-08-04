import * as x from "../services/interviewWorkflow.service.js";
import { InterviewProcess } from "../models/InterviewProcess.js";
import { InterviewRound } from "../models/InterviewRound.js";
import { InterviewSchedule } from "../models/InterviewSchedule.js";
import { AppError } from "../shared/errors/AppError.js";
import { serializeRecruiterProcess } from "../utils/interviewSerializer.js";

const h = (f) => async (r, s, n) => {
  try {
    return await f(r, s);
  } catch (e) {
    return n(e);
  }
};

export const create = h(async (r, s) =>
  s
    .status(201)
    .json({
      success: true,
      message: "Interview process created successfully",
      data: { process: await x.createProcess(r.company.id, r.user.id, r.body) },
    }),
);

export const list = h(async (r, s) =>
  s.json({
    success: true,
    message: "Interview processes retrieved successfully",
    data: await x.listProcesses(r.company.id, r.validatedQuery),
  }),
);

export const get = h(async (r, s) => {
  const process = await InterviewProcess.findOne({
    _id: r.params.processId,
    company: r.company.id,
    isArchived: false,
  });
  if (!process) throw new AppError("Interview process not found", 404);
  const [rounds, schedules] = await Promise.all([
    InterviewRound.find({ process: process.id, company: r.company.id }).lean(),
    InterviewSchedule.find({
      process: process.id,
      company: r.company.id,
    }).lean(),
  ]);
  return s.json({
    success: true,
    message: "Interview process retrieved successfully",
    data: { process: serializeRecruiterProcess(process, rounds, schedules) },
  });
});

export const cancel = h(async (r, s) => {
  const reqMeta = { ipAddress: r.ip, userAgent: r.headers['user-agent'] };
  return s.json({
    success: true,
    message: "Interview process cancelled successfully",
    data: {
      process: await x.cancelProcess(
        r.company.id,
        r.params.processId,
        r.user.id,
        r.body.reason,
        reqMeta
      ),
    },
  });
});

export const archive = h(async (r, s) =>
  s.json({
    success: true,
    message: "Interview process archived successfully",
    data: {
      process: await x.archiveProcess(
        r.company.id,
        r.params.processId,
        r.user.id,
      ),
    },
  }),
);

export const finalize = h(async (r, s) => {
  const reqMeta = { ipAddress: r.ip, userAgent: r.headers['user-agent'] };
  return s.json({
    success: true,
    message: "Interview process finalized successfully",
    data: {
      process: await x.finalizeProcess(
        r.company.id,
        r.params.processId,
        r.user.id,
        r.body,
        reqMeta
      ),
    },
  });
});

export const release = h(async (r, s) =>
  s.json({
    success: true,
    message: "Interview feedback released successfully",
    data: {
      process: await x.releaseFeedback(
        r.company.id,
        r.params.processId,
        r.user.id,
      ),
    },
  }),
);

export const mine = h(async (r, s) =>
  s.json({
    success: true,
    message: "Interviews retrieved successfully",
    data: { processes: await x.listMine(r.user.id) },
  }),
);

export const my = h(async (r, s) =>
  s.json({
    success: true,
    message: "Interview retrieved successfully",
    data: { process: await x.getMine(r.user.id, r.params.processId) },
  }),
);
