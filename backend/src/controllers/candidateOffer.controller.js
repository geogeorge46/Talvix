import * as x from '../services/candidateOffer.service.js';
import { generateOfferLetterHtml } from '../utils/offerDocumentGenerator.js';

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

export const list = h(async (r, s) =>
  s.json({
    success: true,
    message: 'Offers retrieved successfully',
    data: { offers: await x.list(r.user.id, r.validatedQuery) }
  })
);

export const get = h(async (r, s) =>
  s.json({
    success: true,
    message: 'Offer retrieved successfully',
    data: { offer: await x.get(r.user.id, r.params.offerId, getReqMeta(r)) }
  })
);

export const view = h(async (r, s) =>
  s.json({
    success: true,
    message: 'Offer marked as viewed successfully',
    data: { offer: await x.view(r.user.id, r.params.offerId, getReqMeta(r)) }
  })
);

export const accept = h(async (r, s) =>
  s.json({
    success: true,
    message: 'Offer accepted successfully',
    data: await x.accept(r.user.id, r.params.offerId, r.body, getReqMeta(r))
  })
);

export const decline = h(async (r, s) =>
  s.json({
    success: true,
    message: 'Offer declined successfully',
    data: { offer: await x.decline(r.user.id, r.params.offerId, r.body, getReqMeta(r)) }
  })
);

export const negotiate = h(async (r, s) =>
  s.json({
    success: true,
    message: 'Offer negotiation requested successfully',
    data: { offer: await x.negotiate(r.user.id, r.params.offerId, r.body, getReqMeta(r)) }
  })
);

export const timeline = h(async (r, s) =>
  s.json({
    success: true,
    message: 'Offer timeline retrieved successfully',
    data: { timeline: await x.timeline(r.user.id, r.params.offerId) }
  })
);

export const downloadLetter = h(async (r, s) => {
  const offer = await x.getRaw(r.user.id, r.params.offerId, getReqMeta(r));
  const html = generateOfferLetterHtml(offer);
  s.setHeader('Content-Type', 'text/html');
  s.setHeader('Content-Disposition', `attachment; filename="offer-letter-${offer.offerNumber}.html"`);
  return s.send(html);
});
