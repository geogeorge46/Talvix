import { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from './useSocket';

export interface UseWebRTCOptions {
  scheduleId?: string;
  isInitiator?: boolean;
}

const getIceServers = (): RTCIceServer[] => {
  const stunUrl = import.meta.env.VITE_WEBRTC_STUN_URL;
  const turnUrl = import.meta.env.VITE_WEBRTC_TURN_URL;
  const username = import.meta.env.VITE_WEBRTC_TURN_USERNAME;
  const credential = import.meta.env.VITE_WEBRTC_TURN_CREDENTIAL;

  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ];
  if (stunUrl && !servers.some((s) => s.urls === stunUrl)) {
    servers.unshift({ urls: stunUrl });
  }
  if (turnUrl) {
    servers.push({
      urls: turnUrl,
      username: username || '',
      credential: credential || '',
    });
  }
  return servers;
};

export function useWebRTC(options: UseWebRTCOptions = {}) {
  const { scheduleId, isInitiator = false } = options;

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peerConnectionState, setPeerConnectionState] = useState<string>('disconnected');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingIceCandidates = useRef<RTCIceCandidateInit[]>([]);

  // Create & emit WebRTC offer
  const initiateCall = useCallback(async () => {
    if (!pcRef.current || pcRef.current.signalingState !== 'stable') return;
    try {
      const offer = await pcRef.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pcRef.current.setLocalDescription(offer);
      socket.emitOffer(offer);
    } catch (err) {
      console.error('Error creating WebRTC offer', err);
    }
  }, []);

  // Socket setup
  const socket = useSocket({
    scheduleId,
    onJoinedRoom: async (data) => {
      if (isInitiator && data.activeUsers && data.activeUsers.length > 1) {
        await initiateCall();
      }
    },
    onUserJoined: async () => {
      if (isInitiator) {
        await initiateCall();
      }
    },
    onOffer: async ({ offer }) => {
      try {
        if (!pcRef.current) return;
        if (pcRef.current.signalingState !== 'stable') {
          try {
            await pcRef.current.setLocalDescription({ type: 'rollback' });
          } catch {
            // ignore rollback error if not supported
          }
        }
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(offer));

        while (pendingIceCandidates.current.length > 0) {
          const candidate = pendingIceCandidates.current.shift();
          if (candidate) {
            try {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
              console.error('Error adding queued ICE candidate', e);
            }
          }
        }

        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        socket.emitAnswer(answer);
      } catch (err) {
        console.error('Error handling WebRTC offer', err);
      }
    },
    onAnswer: async ({ answer }) => {
      try {
        if (!pcRef.current) return;
        if (pcRef.current.signalingState === 'have-local-offer') {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));

          while (pendingIceCandidates.current.length > 0) {
            const candidate = pendingIceCandidates.current.shift();
            if (candidate) {
              try {
                await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
              } catch (e) {
                console.error('Error adding queued ICE candidate', e);
              }
            }
          }
        }
      } catch (err) {
        console.error('Error handling WebRTC answer', err);
      }
    },
    onIceCandidate: async ({ candidate }) => {
      try {
        if (pcRef.current && pcRef.current.remoteDescription && pcRef.current.remoteDescription.type) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          pendingIceCandidates.current.push(candidate);
        }
      } catch (err) {
        console.error('Error adding ICE candidate', err);
      }
    },
    onUserLeft: () => {
      setRemoteStream(null);
      setPeerConnectionState('disconnected');
    },
  });

  // Initialize Media Stream
  const initLocalMedia = useCallback(async () => {
    try {
      if (localStreamRef.current) return localStreamRef.current;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setMediaError(null);
      return stream;
    } catch (err: any) {
      console.error('Error accessing camera/mic', err);
      let msg = 'Unable to access camera or microphone.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera/Microphone permission was denied by the browser.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No camera or microphone found on your device.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = 'Camera or microphone is already in use by another application.';
      }
      setMediaError(msg);
      return null;
    }
  }, []);

  // Create Peer Connection
  const createPeerConnection = useCallback(
    (stream: MediaStream) => {
      if (pcRef.current) {
        pcRef.current.close();
      }

      const pc = new RTCPeerConnection({
        iceServers: getIceServers(),
      });

      pcRef.current = pc;

      // Add local tracks to peer connection
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // On Remote Track
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        } else {
          const newStream = new MediaStream([event.track]);
          setRemoteStream(newStream);
        }
      };

      // On ICE Candidate
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emitIceCandidate(event.candidate.toJSON());
        }
      };

      // Connection State Change
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        setPeerConnectionState(state);
        socket.emitConnectionState(state);
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
          setPeerConnectionState('reconnecting');
        }
      };

      return pc;
    },
    [socket.emitIceCandidate, socket.emitConnectionState],
  );

  useEffect(() => {
    if (!scheduleId) return;

    let isSubscribed = true;

    initLocalMedia().then((stream) => {
      if (stream && isSubscribed) {
        const pc = createPeerConnection(stream);
        if (isInitiator && socket.activeParticipants.length > 1) {
          setTimeout(() => {
            if (isSubscribed && pc.signalingState === 'stable') {
              pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
                .then((offer) => pc.setLocalDescription(offer).then(() => socket.emitOffer(offer)))
                .catch((err) => console.error('Error in delayed offer creation', err));
            }
          }, 300);
        }
      }
    });

    return () => {
      isSubscribed = false;
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
    };
  }, [scheduleId, isInitiator, socket.activeParticipants, initLocalMedia, createPeerConnection, socket.emitOffer]);

  // Trigger offer if active participants exist and remoteStream is missing
  useEffect(() => {
    if (isInitiator && socket.activeParticipants.length > 1 && pcRef.current && !remoteStream) {
      if (pcRef.current.signalingState === 'stable') {
        initiateCall();
      }
    }
  }, [isInitiator, socket.activeParticipants, remoteStream, initiateCall]);

  // Toggle Audio Mute
  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  }, []);

  // Toggle Video Enable/Disable
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoMuted(!videoTrack.enabled);
      }
    }
  }, []);

  // Reconnect WebRTC
  const retryConnection = useCallback(async () => {
    const stream = localStreamRef.current || (await initLocalMedia());
    if (!stream) return;

    const pc = createPeerConnection(stream);
    if (isInitiator) {
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      socket.emitOffer(offer);
    }
  }, [initLocalMedia, createPeerConnection, isInitiator, socket.emitOffer]);

  return {
    localStream,
    remoteStream,
    peerConnectionState,
    isAudioMuted,
    isVideoMuted,
    mediaError,
    isConnected: socket.isConnected,
    activeParticipants: socket.activeParticipants,
    toggleAudio,
    toggleVideo,
    retryConnection,
    initLocalMedia,
  };
}
