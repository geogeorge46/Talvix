import { CompanyTag } from '../models/CompanyTag.js';
import { AppError } from '../shared/errors/AppError.js';

export const listCompanyTags = async (companyId) => {
  return CompanyTag.find({ company: companyId }).sort({ name: 1 });
};

export const createCompanyTag = async (companyId, name, color) => {
  const normalized = name.trim().toLowerCase();
  if (!normalized) throw new AppError('Tag name is required', 400);

  const existing = await CompanyTag.findOne({ company: companyId, name: normalized });
  if (existing) {
    if (color) {
      existing.color = color;
      await existing.save();
    }
    return existing;
  }

  return CompanyTag.create({
    company: companyId,
    name: normalized,
    color: color || '#6366F1'
  });
};

export const deleteCompanyTag = async (companyId, tagId) => {
  const deleted = await CompanyTag.findOneAndDelete({ _id: tagId, company: companyId });
  if (!deleted) throw new AppError('Company tag not found', 404);
};
