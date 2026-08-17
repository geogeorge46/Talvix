import * as talentPoolService from '../services/talentPool.service.js';
import { CompanyTag } from '../models/CompanyTag.js';

export const getTalentPool = async (request, response, next) => {
  try {
    const companyId = request.company.id;
    const result = await talentPoolService.listTalentPool(companyId, request.validatedQuery);
    return response.json({
      success: true,
      data: result
    });
  } catch (error) {
    return next(error);
  }
};

export const addToTalentPool = async (request, response, next) => {
  try {
    const companyId = request.company.id;
    const recruiterId = request.user.id;
    const { candidateId, status, tags } = request.body;
    
    const member = await talentPoolService.addMemberToPool(
      companyId,
      candidateId,
      status,
      tags,
      recruiterId
    );

    return response.status(201).json({
      success: true,
      message: 'Candidate added to talent pool successfully',
      data: { member }
    });
  } catch (error) {
    return next(error);
  }
};

export const updateMemberTagsOrStatus = async (request, response, next) => {
  try {
    const companyId = request.company.id;
    const { id } = request.params;
    
    const member = await talentPoolService.updateMember(companyId, id, request.body);
    
    return response.json({
      success: true,
      message: 'Member updated successfully',
      data: { member }
    });
  } catch (error) {
    return next(error);
  }
};

export const addNoteToMember = async (request, response, next) => {
  try {
    const companyId = request.company.id;
    const { id } = request.params;
    const recruiterId = request.user.id;
    const { content } = request.body;

    const member = await talentPoolService.addNote(companyId, id, content, recruiterId);

    return response.json({
      success: true,
      message: 'Note added successfully',
      data: { member }
    });
  } catch (error) {
    return next(error);
  }
};

export const removeFromTalentPool = async (request, response, next) => {
  try {
    const companyId = request.company.id;
    const { id } = request.params;

    await talentPoolService.removeMember(companyId, id);

    return response.json({
      success: true,
      message: 'Member removed from talent pool successfully'
    });
  } catch (error) {
    return next(error);
  }
};

export const getCompanyTags = async (request, response, next) => {
  try {
    const companyId = request.company.id;
    const tags = await CompanyTag.find({ company: companyId });
    return response.json({
      success: true,
      data: { tags }
    });
  } catch (error) {
    return next(error);
  }
};

export const createCompanyTag = async (request, response, next) => {
  try {
    const companyId = request.company.id;
    const { name, color } = request.body;
    const tag = await CompanyTag.create({ company: companyId, name, color });
    return response.status(201).json({
      success: true,
      message: 'Tag created successfully',
      data: { tag }
    });
  } catch (error) {
    return next(error);
  }
};
