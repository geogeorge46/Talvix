import { createCompanyTag, deleteCompanyTag, listCompanyTags } from '../services/companyTag.service.js';

export const getCompanyTags = async (request, response, next) => {
  try {
    const tags = await listCompanyTags(request.company._id);
    return response.json({ success: true, message: 'Company tags retrieved successfully', data: { tags } });
  } catch (error) {
    return next(error);
  }
};

export const addCompanyTag = async (request, response, next) => {
  try {
    const tag = await createCompanyTag(request.company._id, request.body.name, request.body.color);
    return response.status(201).json({ success: true, message: 'Company tag created successfully', data: { tag } });
  } catch (error) {
    return next(error);
  }
};

export const removeCompanyTag = async (request, response, next) => {
  try {
    await deleteCompanyTag(request.company._id, request.params.tagId);
    return response.json({ success: true, message: 'Company tag deleted successfully' });
  } catch (error) {
    return next(error);
  }
};
