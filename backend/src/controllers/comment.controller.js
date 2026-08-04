import { createApplicationComment, deleteApplicationComment, listApplicationComments } from '../services/comment.service.js';

export const getApplicationComments = async (request, response, next) => {
  try {
    const comments = await listApplicationComments(request.company._id, request.params.applicationId);
    return response.json({ success: true, message: 'Comments retrieved successfully', data: { comments } });
  } catch (error) {
    return next(error);
  }
};

export const addApplicationComment = async (request, response, next) => {
  try {
    const comment = await createApplicationComment(request.company._id, request.params.applicationId, request.user.id, request.body);
    return response.status(201).json({ success: true, message: 'Comment created successfully', data: { comment } });
  } catch (error) {
    return next(error);
  }
};

export const removeApplicationComment = async (request, response, next) => {
  try {
    await deleteApplicationComment(request.company._id, request.params.commentId, request.user.id);
    return response.json({ success: true, message: 'Comment deleted successfully' });
  } catch (error) {
    return next(error);
  }
};
