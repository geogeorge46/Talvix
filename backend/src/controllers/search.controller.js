import * as service from '../services/search.service.js';

export const globalSearch = async (req, res, next) => {
  try {
    const query = req.query.q || '';
    const results = await service.executeGlobalSearch(query, req.user);
    return res.status(200).json({
      success: true,
      data: results
    });
  } catch (error) {
    return next(error);
  }
};
