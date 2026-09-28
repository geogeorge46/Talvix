import { Server } from 'socket.io';
import { verifyAccessToken } from './utils/jwt.js';
import { User } from './models/User.js';
import { InterviewSchedule } from './models/InterviewSchedule.js';
import { CompanyMember } from './models/CompanyMember.js';
import { logger } from './shared/utils/logger.js';

let io = null;

export const initSocketServer = (httpServer, clientUrl) => {
  io = new Server(httpServer, {
    cors: {
      origin: clientUrl || '*',
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '') ||
        socket.handshake.query?.token;

      if (!token) {
        return next(new Error('Authentication error: Token missing'));
      }

      const decoded = verifyAccessToken(token);
      if (!decoded || !decoded.userId) {
        return next(new Error('Authentication error: Invalid token'));
      }

      const user = await User.findById(decoded.userId).select('_id fullName email role company').lean();
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.user = {
        id: String(user._id),
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        company: user.company ? String(user.company) : null
      };

      return next();
    } catch (error) {
      logger.error('Socket authentication failed', error);
      return next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id} (User: ${socket.user.id}, Role: ${socket.user.role})`);

    // Utility: verify room membership authorization
    const verifyRoomAuthorization = async (scheduleId) => {
      if (!scheduleId) return null;
      const schedule = await InterviewSchedule.findById(scheduleId).select('candidate interviewers company status scheduledAt endsAt joinAvailableAt').lean();
      if (!schedule) return null;

      const userId = socket.user.id;
      const isCandidate = String(schedule.candidate) === userId;
      let isInterviewer = schedule.interviewers?.map(String).includes(userId);

      if (!isInterviewer && socket.user.role === 'recruiter') {
        const member = await CompanyMember.findOne({
          company: schedule.company,
          recruiter: userId,
          status: 'active'
        }).select('_id').lean();
        if (member) isInterviewer = true;
      }

      if (!isCandidate && !isInterviewer && socket.user.role !== 'admin') {
        return null;
      }

      return {
        schedule,
        roleInInterview: isCandidate ? 'candidate' : 'interviewer'
      };
    };

    // Join Interview Room
    socket.on('interview:join-room', async (data) => {
      try {
        const scheduleId = typeof data === 'string' ? data : data?.scheduleId;
        const authResult = await verifyRoomAuthorization(scheduleId);

        if (!authResult) {
          socket.emit('interview:error', { code: 'WEBRTC_SIGNALING_UNAUTHORIZED', message: 'Unauthorized room access' });
          return;
        }

        const roomName = `interview:${scheduleId}`;
        await socket.join(roomName);
        socket.currentInterviewId = scheduleId;

        const updateData = {};
        const now = new Date();
        if (authResult.roleInInterview === 'candidate') {
          updateData.candidateJoinedAt = now;
        } else {
          updateData.interviewerJoinedAt = now;
        }

        await InterviewSchedule.updateOne({ _id: scheduleId }, { $set: updateData });

        logger.info(`User ${socket.user.id} (${authResult.roleInInterview}) joined room ${roomName}`);

        // Notify other participants in room
        socket.to(roomName).emit('interview:user-joined', {
          userId: socket.user.id,
          role: authResult.roleInInterview,
          fullName: socket.user.fullName,
          joinedAt: now
        });

        // Acknowledge join to sender with current participant list
        const roomSockets = await io.in(roomName).fetchSockets();
        const activeUsers = roomSockets.map(s => ({
          userId: s.user.id,
          fullName: s.user.fullName,
          role: s.user.role
        }));

        socket.emit('interview:joined-room', {
          scheduleId,
          roleInInterview: authResult.roleInInterview,
          activeUsers
        });

      } catch (err) {
        logger.error('Error in interview:join-room', err);
        socket.emit('interview:error', { code: 'ROOM_JOIN_ERROR', message: err.message });
      }
    });

    // Signaling: Offer
    socket.on('interview:offer', async (data) => {
      try {
        const { scheduleId, offer } = data || {};
        if (!scheduleId || !offer) return;
        const roomName = `interview:${scheduleId}`;

        if (!socket.rooms.has(roomName)) {
          const authResult = await verifyRoomAuthorization(scheduleId);
          if (!authResult) return;
          await socket.join(roomName);
        }

        socket.to(roomName).emit('interview:offer', {
          offer,
          senderId: socket.user.id,
          senderRole: socket.user.role
        });
      } catch (err) {
        logger.error('Error in interview:offer', err);
      }
    });

    // Signaling: Answer
    socket.on('interview:answer', async (data) => {
      try {
        const { scheduleId, answer } = data || {};
        if (!scheduleId || !answer) return;
        const roomName = `interview:${scheduleId}`;

        if (!socket.rooms.has(roomName)) {
          const authResult = await verifyRoomAuthorization(scheduleId);
          if (!authResult) return;
          await socket.join(roomName);
        }

        socket.to(roomName).emit('interview:answer', {
          answer,
          senderId: socket.user.id,
          senderRole: socket.user.role
        });
      } catch (err) {
        logger.error('Error in interview:answer', err);
      }
    });

    // Signaling: ICE Candidate
    socket.on('interview:ice-candidate', async (data) => {
      try {
        const { scheduleId, candidate } = data || {};
        if (!scheduleId || !candidate) return;
        const roomName = `interview:${scheduleId}`;

        if (!socket.rooms.has(roomName)) {
          const authResult = await verifyRoomAuthorization(scheduleId);
          if (!authResult) return;
          await socket.join(roomName);
        }

        socket.to(roomName).emit('interview:ice-candidate', {
          candidate,
          senderId: socket.user.id
        });
      } catch (err) {
        logger.error('Error in interview:ice-candidate', err);
      }
    });

    // Connection State Update
    socket.on('interview:connection-state', (data) => {
      const { scheduleId, state } = data || {};
      if (scheduleId) {
        socket.to(`interview:${scheduleId}`).emit('interview:connection-state', {
          userId: socket.user.id,
          state
        });
      }
    });

    // Leave Room
    socket.on('interview:leave-room', async (data) => {
      const scheduleId = typeof data === 'string' ? data : data?.scheduleId;
      if (scheduleId) {
        const roomName = `interview:${scheduleId}`;
        socket.leave(roomName);
        socket.to(roomName).emit('interview:user-left', {
          userId: socket.user.id,
          fullName: socket.user.fullName
        });
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id} (User: ${socket.user.id})`);
      if (socket.currentInterviewId) {
        socket.to(`interview:${socket.currentInterviewId}`).emit('interview:user-left', {
          userId: socket.user.id,
          fullName: socket.user.fullName,
          reason: 'disconnected'
        });
      }
    });
  });

  return io;
};

export const getSocketIO = () => io;

export const broadcastInterviewEvent = (scheduleId, eventName, payload) => {
  if (!io) return;
  io.to(`interview:${scheduleId}`).emit(eventName, payload);
};
