import * as service from '../services/communication.service.js';
import { AppError } from '../shared/errors/AppError.js';

const handle = (fn) => async (request, response, next) => { try { return await fn(request, response); } catch (error) { return next(error); } };
const ok = (response, message, data, status = 200) => response.status(status).json({ success: true, message, data });
const companyId = (request) => request.company.id;

export const createConversation = handle(async (request, response) => {
  const { participants } = request.body;
  if (!participants || !Array.isArray(participants)) throw new AppError('participants array is required', 400);

  const conversation = await service.createConversation(participants, companyId(request), request.user.id);
  return ok(response, 'Conversation created successfully', { conversation }, 201);
});

export const createMessage = handle(async (request, response) => {
  const { conversationId, text } = request.body;
  if (!conversationId || !text) throw new AppError('conversationId and text parameters are required', 400);

  const message = await service.createMessage(conversationId, text, companyId(request), request.user.id);
  return ok(response, 'Message posted successfully', { message }, 201);
});

export const listConversations = handle(async (request, response) => {
  const conversations = await service.getConversations(companyId(request), request.user.id);
  return ok(response, 'Conversations loaded successfully', { conversations });
});

export const listMessages = handle(async (request, response) => {
  const { conversationId } = request.params;
  if (!conversationId) throw new AppError('conversationId parameter is required', 400);

  const messages = await service.getMessages(conversationId, companyId(request));
  return ok(response, 'Messages loaded successfully', { messages });
});

export const postNote = handle(async (request, response) => {
  const { interviewScheduleId, text, rating, isPrivate } = request.body;
  if (!interviewScheduleId || !text) throw new AppError('interviewScheduleId and text are required', 400);

  const discussion = await service.addInterviewNote(
    interviewScheduleId,
    text,
    rating,
    isPrivate,
    companyId(request),
    request.user.id
  );
  return ok(response, 'Note added successfully', { discussion });
});

export const postActionItem = handle(async (request, response) => {
  const { interviewScheduleId, title, assignedTo } = request.body;
  if (!interviewScheduleId || !title || !assignedTo) throw new AppError('interviewScheduleId, title, and assignedTo are required', 400);

  const discussion = await service.addInterviewActionItem(
    interviewScheduleId,
    title,
    assignedTo,
    companyId(request),
    request.user.id
  );
  return ok(response, 'Action item created successfully', { discussion });
});

export const aiSummary = handle(async (request, response) => {
  const { chatLogs } = request.body;
  if (!chatLogs) throw new AppError('chatLogs content parameter is required', 400);

  const summary = await service.generateChatSummary(
    chatLogs,
    companyId(request),
    request.user.id,
    { userId: request.user.id, companyId: companyId(request) }
  );

  return ok(response, 'Conversation summarized successfully', { summary });
});

export const createRoom = handle(async (request, response) => {
  const { title, interviewScheduleId } = request.body;
  if (!title) throw new AppError('title parameter is required', 400);

  const room = await service.createVideoRoom(title, interviewScheduleId, companyId(request), request.user.id);
  return ok(response, 'Video room initialized successfully', { room }, 201);
});
