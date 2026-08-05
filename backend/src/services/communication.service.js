import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { InterviewRoom } from '../models/InterviewRoom.js';
import { InterviewDiscussion } from '../models/InterviewDiscussion.js';
import { invokeAIGateway } from './aiProvider.service.js';
import { parseJSON } from './jsonParser.service.js';
import { z } from 'zod';

const summarySchema = z.object({
  highlights: z.array(z.string()).default([]),
  strengths: z.array(z.string()).default([]),
  concerns: z.array(z.string()).default([]),
  suggestedQuestions: z.array(z.string()).default([]),
  actionItems: z.array(z.string()).default([])
});

export const createConversation = async (participants, companyId, userId) => {
  return await Conversation.create({
    company: companyId,
    participants,
    createdBy: userId
  });
};

export const createMessage = async (conversationId, text, companyId, userId) => {
  const message = await Message.create({
    company: companyId,
    conversation: conversationId,
    sender: userId,
    text,
    createdBy: userId
  });

  await Conversation.findByIdAndUpdate(conversationId, { lastMessage: message._id });
  return message;
};

export const getConversations = async (companyId, userId) => {
  return await Conversation.find({ company: companyId, participants: userId }).populate('lastMessage');
};

export const getMessages = async (conversationId, companyId) => {
  return await Message.find({ conversation: conversationId, company: companyId }).sort({ createdAt: 1 });
};

export const addInterviewNote = async (interviewScheduleId, text, rating, isPrivate, companyId, userId) => {
  let discussion = await InterviewDiscussion.findOne({ interviewSchedule: interviewScheduleId, company: companyId });
  if (!discussion) {
    discussion = await InterviewDiscussion.create({
      company: companyId,
      interviewSchedule: interviewScheduleId,
      createdBy: userId
    });
  }

  discussion.notes.push({
    author: userId,
    text,
    rating,
    isPrivate
  });

  await discussion.save();
  return discussion;
};

export const addInterviewActionItem = async (interviewScheduleId, title, assignedTo, companyId, userId) => {
  let discussion = await InterviewDiscussion.findOne({ interviewSchedule: interviewScheduleId, company: companyId });
  if (!discussion) {
    discussion = await InterviewDiscussion.create({
      company: companyId,
      interviewSchedule: interviewScheduleId,
      createdBy: userId
    });
  }

  discussion.actionItems.push({
    assignedTo,
    title,
    done: false
  });

  await discussion.save();
  return discussion;
};

export const generateChatSummary = async (chatLogs, companyId, userId, context = {}) => {
  const res = await invokeAIGateway('chat_summary', { chatLogs }, context);
  const data = parseJSON(res, summarySchema);

  return {
    summaryText: `Highlights: ${data.highlights.join(', ')}. Action Items: ${data.actionItems.join(', ')}`,
    ...data
  };
};

export const createVideoRoom = async (title, interviewScheduleId, companyId, userId) => {
  return await InterviewRoom.create({
    company: companyId,
    title,
    interviewSchedule: interviewScheduleId,
    status: 'scheduled',
    videoUrl: `https://meet.talvix.com/rooms/${Math.random().toString(36).substring(7)}`,
    createdBy: userId
  });
};
