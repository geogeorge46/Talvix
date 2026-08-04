import { CompanyMember } from '../models/CompanyMember.js';

// Map: companyId -> Map(userId -> Set of response objects)
const activeStreams = new Map();
// Keep track of presence states
const presenceStates = new Map(); // userId -> { status: 'online', lastActive: Date }

export const registerClient = async (companyId, userId, response) => {
  const companyKey = String(companyId);
  const userKey = String(userId);

  if (!activeStreams.has(companyKey)) {
    activeStreams.set(companyKey, new Map());
  }

  const companyUsers = activeStreams.get(companyKey);
  if (!companyUsers.has(userKey)) {
    companyUsers.set(userKey, new Set());
  }

  companyUsers.get(userKey).add(response);

  presenceStates.set(userKey, { status: 'online', lastActive: new Date() });
  broadcastPresence(companyId);

  // Send initial message
  response.write(`data: ${JSON.stringify({ type: 'connected', userId })}\n\n`);
};

export const removeClient = (companyId, userId, response) => {
  const companyKey = String(companyId);
  const userKey = String(userId);

  const companyUsers = activeStreams.get(companyKey);
  if (companyUsers && companyUsers.has(userKey)) {
    const userResponses = companyUsers.get(userKey);
    userResponses.delete(response);
    if (userResponses.size === 0) {
      companyUsers.delete(userKey);
      presenceStates.delete(userKey);
    }
  }

  if (companyUsers && companyUsers.size === 0) {
    activeStreams.delete(companyKey);
  }

  broadcastPresence(companyId);
};

export const broadcastToCompany = (companyId, eventName, data) => {
  const companyKey = String(companyId);
  const companyUsers = activeStreams.get(companyKey);

  if (!companyUsers) return;

  const payload = JSON.stringify({ type: eventName, data });

  for (const [userId, userResponses] of companyUsers.entries()) {
    for (const response of userResponses) {
      response.write(`event: ${eventName}\n`);
      response.write(`data: ${payload}\n\n`);
    }
  }
};

export const broadcastPresence = async (companyId) => {
  const companyKey = String(companyId);
  const companyUsers = activeStreams.get(companyKey);

  // Load active members status from Mongoose, but overlay with real-time SSE presence status
  const members = await CompanyMember.find({ company: companyId, status: 'active' }).populate('recruiter', 'fullName email');

  const presenceList = members.map(m => {
    const userId = String(m.recruiter?._id || m.recruiter);
    const isOnline = presenceStates.has(userId);
    return {
      userId,
      name: m.recruiter?.fullName || 'Unknown',
      email: m.recruiter?.email || '',
      role: m.role,
      online: isOnline,
      lastActive: m.lastActive || m.updatedAt
    };
  });

  broadcastToCompany(companyId, 'presence_update', presenceList);
};

export const updatePresenceTick = (companyId, userId) => {
  presenceStates.set(String(userId), { status: 'online', lastActive: new Date() });
  broadcastPresence(companyId);
};

// Keep-alive pings sent every 15 seconds to prevent client timeout
setInterval(() => {
  for (const [companyId, companyUsers] of activeStreams.entries()) {
    for (const [userId, userResponses] of companyUsers.entries()) {
      for (const response of userResponses) {
        response.write(`: ping\n\n`);
      }
    }
  }
}, 15000);

export const broadcastAssessmentActivity = (companyId, attemptId, eventType, details) => {
  broadcastToCompany(companyId, 'assessment_activity', {
    attemptId,
    eventType,
    timestamp: new Date(),
    ...details
  });
};
