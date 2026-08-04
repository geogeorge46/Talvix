import { Comment } from '../models/Comment.js';
import { CompanyMember } from '../models/CompanyMember.js';
import { Application } from '../models/Application.js';
import { AppError } from '../shared/errors/AppError.js';
import mongoose from 'mongoose';

const parseMentions = async (text, companyId) => {
  if (!text) return [];
  const words = text.split(/\s+/);
  const mentionTokens = words.filter(w => w.startsWith('@')).map(w => w.slice(1).replace(/[^a-zA-Z0-9.@-]/g, ''));
  if (!mentionTokens.length) return [];
  const members = await CompanyMember.find({ company: companyId, status: 'active' }).populate('recruiter');
  const matchedUserIds = [];
  for (const token of mentionTokens) {
    const matched = members.find(m =>
      m.recruiter &&
      (m.recruiter.email.toLowerCase().includes(token.toLowerCase()) ||
       m.recruiter.fullName.toLowerCase().replace(/\s+/g, '').includes(token.toLowerCase()))
    );
    if (matched) matchedUserIds.push(matched.recruiter._id);
  }
  return matchedUserIds;
};

export const listApplicationComments = async (companyId, applicationId) => {
  // Ensure application belongs to company
  const exists = await Application.exists({ _id: applicationId, company: companyId });
  if (!exists) throw new AppError('Application not found', 404);

  return Comment.find({ application: applicationId, company: companyId })
    .populate('author', 'fullName email avatar')
    .sort({ createdAt: 1 });
};

export const createApplicationComment = async (companyId, applicationId, authorId, input) => {
  const application = await Application.findOne({ _id: applicationId, company: companyId });
  if (!application) throw new AppError('Application not found', 404);

  const mentions = await parseMentions(input.content, companyId);

  const comment = await Comment.create({
    application: applicationId,
    company: companyId,
    author: authorId,
    content: input.content,
    parentId: input.parentId ? new mongoose.Types.ObjectId(input.parentId) : null,
    mentions,
    attachments: input.attachments || []
  });

  return Comment.findById(comment._id).populate('author', 'fullName email avatar');
};

export const deleteApplicationComment = async (companyId, commentId, authorId) => {
  const comment = await Comment.findOne({ _id: commentId, company: companyId });
  if (!comment) throw new AppError('Comment not found', 404);

  if (!comment.author.equals(authorId)) {
    throw new AppError('Unauthorized to delete this comment', 403);
  }

  await Comment.deleteOne({ _id: commentId });
  // Delete child comments in the thread
  await Comment.deleteMany({ parentId: commentId });
};
