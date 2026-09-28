import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { tokenStore } from '../../../api/client';

const getSocketUrl = () => {
  const envUrl = import.meta.env.VITE_WS_URL;
  if (envUrl) return envUrl;
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';
  return baseUrl.replace(/\/api\/v1\/?$/, '');
};

export interface UseSocketOptions {
  scheduleId?: string;
  onJoinedRoom?: (data: { scheduleId: string; roleInInterview: string; activeUsers: any[] }) => void;
  onUserJoined?: (data: { userId: string; role: string; fullName?: string }) => void;
  onUserLeft?: (data: { userId: string; fullName?: string }) => void;
  onOffer?: (data: { offer: RTCSessionDescriptionInit; senderId: string }) => void;
  onAnswer?: (data: { answer: RTCSessionDescriptionInit; senderId: string }) => void;
  onIceCandidate?: (data: { candidate: RTCIceCandidateInit; senderId: string }) => void;
  onConnectionState?: (data: { userId: string; state: string }) => void;
  onRescheduled?: (data: any) => void;
  onEnded?: (data: any) => void;
  onError?: (data: { code: string; message: string }) => void;
}

export function useSocket(options: UseSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeParticipants, setActiveParticipants] = useState<any[]>([]);

  const {
    scheduleId,
    onJoinedRoom,
    onUserJoined,
    onUserLeft,
    onOffer,
    onAnswer,
    onIceCandidate,
    onConnectionState,
    onRescheduled,
    onEnded,
    onError
  } = options;

  useEffect(() => {
    if (!scheduleId) return;

    const token = tokenStore.get();
    const serverUrl = getSocketUrl();

    const socket = io(serverUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('interview:join-room', { scheduleId });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('interview:joined-room', (data) => {
      if (data?.activeUsers) {
        setActiveParticipants(data.activeUsers);
      }
      onJoinedRoom?.(data);
    });

    socket.on('interview:user-joined', (data) => {
      setActiveParticipants((prev) => {
        if (prev.some((p) => p.userId === data.userId)) return prev;
        return [...prev, data];
      });
      onUserJoined?.(data);
    });

    socket.on('interview:user-left', (data) => {
      setActiveParticipants((prev) => prev.filter((p) => p.userId !== data.userId));
      onUserLeft?.(data);
    });

    socket.on('interview:offer', (data) => {
      onOffer?.(data);
    });

    socket.on('interview:answer', (data) => {
      onAnswer?.(data);
    });

    socket.on('interview:ice-candidate', (data) => {
      onIceCandidate?.(data);
    });

    socket.on('interview:connection-state', (data) => {
      onConnectionState?.(data);
    });

    socket.on('interview:rescheduled', (data) => {
      onRescheduled?.(data);
    });

    socket.on('interview:ended', (data) => {
      onEnded?.(data);
    });

    socket.on('interview:error', (data) => {
      onError?.(data);
    });

    return () => {
      if (socket.connected) {
        socket.emit('interview:leave-room', { scheduleId });
      }
      socket.disconnect();
      socketRef.current = null;
    };
  }, [scheduleId]);

  const emitOffer = useCallback((offer: RTCSessionDescriptionInit) => {
    if (socketRef.current && scheduleId) {
      socketRef.current.emit('interview:offer', { scheduleId, offer });
    }
  }, [scheduleId]);

  const emitAnswer = useCallback((answer: RTCSessionDescriptionInit) => {
    if (socketRef.current && scheduleId) {
      socketRef.current.emit('interview:answer', { scheduleId, answer });
    }
  }, [scheduleId]);

  const emitIceCandidate = useCallback((candidate: RTCIceCandidateInit) => {
    if (socketRef.current && scheduleId) {
      socketRef.current.emit('interview:ice-candidate', { scheduleId, candidate });
    }
  }, [scheduleId]);

  const emitConnectionState = useCallback((state: string) => {
    if (socketRef.current && scheduleId) {
      socketRef.current.emit('interview:connection-state', { scheduleId, state });
    }
  }, [scheduleId]);

  return {
    socket: socketRef.current,
    isConnected,
    activeParticipants,
    emitOffer,
    emitAnswer,
    emitIceCandidate,
    emitConnectionState
  };
}
