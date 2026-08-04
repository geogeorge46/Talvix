import * as x from '../services/offerWorkflow.service.js';
import { generateOfferLetterHtml } from '../utils/offerDocumentGenerator.js';
import { analyzeOfferWithAI } from '../services/ai.service.js';

const h = f => async (r, s, n) => {
  try {
    return await f(r, s);
  } catch (e) {
    return n(e);
  }
};

const getReqMeta = (r) => ({
  ipAddress: r.ip || r.headers['x-forwarded-for'] || 'Unknown',
  userAgent: r.headers['user-agent'] || 'Unknown'
});

export const create = h(async (r, s) =>
  s.status(201).json({
    success: true,
    message: 'Offer created successfully',
    data: { offer: await x.create(r.company.id, r.user.id, r.body, getReqMeta(r)) }
  })
);

export const list = h(async (r, s) =>
  s.json({
    success: true,
    message: 'Offers retrieved successfully',
    data: await x.list(r.company.id, r.validatedQuery)
  })
);

export const get = h(async (r, s) =>
  s.json({
    success: true,
    message: 'Offer retrieved successfully',
    data: { offer: await x.get(r.company.id, r.params.offerId) }
  })
);

export const update = h(async (r, s) =>
  s.json({
    success: true,
    message: 'Offer updated successfully',
    data: { offer: await x.update(r.company.id, r.params.offerId, r.body, getReqMeta(r)) }
  })
);

export const requestApproval = h(async (r, s) =>
  s.json({
    success: true,
    message: 'Offer approval requested successfully',
    data: { offer: await x.requestApproval(r.company.id, r.params.offerId, r.user.id, getReqMeta(r)) }
  })
);

export const withdraw = h(async (r, s) =>
  s.json({
    success: true,
    message: 'Offer withdrawn successfully',
    data: { offer: await x.withdraw(r.company.id, r.params.offerId, r.user.id, r.body.reason, getReqMeta(r)) }
  })
);

export const cancel = h(async (r, s) =>
  s.json({
    success: true,
    message: 'Offer cancelled successfully',
    data: { offer: await x.cancel(r.company.id, r.params.offerId, r.user.id, r.body.reason, getReqMeta(r)) }
  })
);

export const archive = h(async (r, s) =>
  s.json({
    success: true,
    message: 'Offer archived successfully',
    data: { offer: await x.archive(r.company.id, r.params.offerId, getReqMeta(r)) }
  })
);

export const history = h(async (r, s) =>
  s.json({
    success: true,
    message: 'Offer history retrieved successfully',
    data: { offers: await x.history(r.company.id, r.params.offerId) }
  })
);

export const revise = h(async (r, s) =>
  s.status(201).json({
    success: true,
    message: 'Offer revision created successfully',
    data: { offer: await x.revise(r.company.id, r.params.offerId, r.user.id, r.body) }
  })
);

export const resolve = h(async (r, s) =>
  s.json({
    success: true,
    message: 'Offer negotiation resolved successfully',
    data: { offer: await x.resolve(r.company.id, r.params.offerId, r.user.id, r.body) }
  })
);

export const hire = h(async (r, s) =>
  s.json({
    success: true,
    message: 'Hiring confirmed successfully',
    data: { offer: await x.confirmHire(r.company.id, r.params.offerId, r.user.id, getReqMeta(r)) }
  })
);

export const completeOnboarding = h(async (r, s) =>
  s.json({
    success: true,
    message: 'Onboarding completed successfully',
    data: { offer: await x.completeOnboarding(r.company.id, r.params.offerId, r.user.id, getReqMeta(r)) }
  })
);

export const previewLetter = h(async (r, s) => {
  const offerObj = await x.get(r.company.id, r.params.offerId);
  const html = generateOfferLetterHtml(offerObj);
  return s.json({
    success: true,
    message: 'Offer letter preview generated successfully',
    data: { html }
  });
});

export const aiAnalysis = h(async (r, s) => {
  const offerObj = await x.get(r.company.id, r.params.offerId);
  const analysis = await analyzeOfferWithAI(offerObj.jobSnapshot, offerObj.candidateSnapshot, offerObj.toObject());
  return s.json({
    success: true,
    message: 'AI Offer analysis completed successfully',
    data: { analysis }
  });
});
