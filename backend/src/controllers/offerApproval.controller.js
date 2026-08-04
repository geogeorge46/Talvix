import * as x from '../services/offerApproval.service.js';

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
    message: 'Offer approvals retrieved successfully',
    data: { offers: await x.list(r.company.id) }
  })
);

export const get = h(async (r, s) =>
  s.json({
    success: true,
    message: 'Offer approval retrieved successfully',
    data: { offer: await x.get(r.company.id, r.params.offerId) }
  })
);

export const approve = h(async (r, s) =>
  s.json({
    success: true,
    message: 'Offer approved successfully',
    data: { offer: await x.approve(r.company.id, r.params.offerId, r.user.id, r.body.comments, getReqMeta(r)) }
  })
);

export const reject = h(async (r, s) =>
  s.json({
    success: true,
    message: 'Offer rejected successfully',
    data: { offer: await x.reject(r.company.id, r.params.offerId, r.user.id, r.body.reason, getReqMeta(r)) }
  })
);

export const send = h(async (r, s) =>
  s.json({
    success: true,
    message: 'Offer sent successfully; it is available in the candidate portal',
    data: { offer: await x.send(r.company.id, r.params.offerId, r.user.id, getReqMeta(r)) }
  })
);
