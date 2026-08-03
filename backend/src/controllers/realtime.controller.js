import { registerClient, removeClient } from '../services/realtime.service.js';

export const stream = async (request, response, next) => {
  try {
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('Content-Encoding', 'none');
    response.flushHeaders();

    await registerClient(request.company._id, request.user.id, response);

    request.on('close', () => {
      removeClient(request.company._id, request.user.id, response);
    });
  } catch (error) {
    return next(error);
  }
};
