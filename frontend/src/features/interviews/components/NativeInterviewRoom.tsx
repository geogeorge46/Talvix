import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthProvider';
import { useScheduleDetails, useStartInterview, useEndInterview } from '../api';
import { useWebRTC } from '../hooks/useWebRTC';
import { WaitingRoom } from './WaitingRoom';
import {
  Mic,
  MicOff,
  Camera,
  CameraOff,
  PhoneOff,
  Clock,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  UserCheck
} from 'lucide-react';

export const NativeInterviewRoom: React.FC = () => {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userRole = user?.role === 'candidate' ? 'candidate' : 'recruiter';

  const { data: schedule, isLoading, refetch } = useScheduleDetails(scheduleId || '', Boolean(scheduleId));
  const startMutation = useStartInterview(scheduleId || '');
  const endMutation = useEndInterview(scheduleId || '');

  const [inRoom, setInRoom] = useState(false);
  const [timerStr, setTimerStr] = useState('00:00');
  const [isEnding, setIsEnding] = useState(false);

  const webRTC = useWebRTC({
    scheduleId,
    isInitiator: userRole === 'recruiter'
  });

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Attach streams
  useEffect(() => {
    if (localVideoRef.current && webRTC.localStream) {
      localVideoRef.current.srcObject = webRTC.localStream;
    }
  }, [webRTC.localStream, inRoom]);

  useEffect(() => {
    if (remoteVideoRef.current && webRTC.remoteStream) {
      remoteVideoRef.current.srcObject = webRTC.remoteStream;
    }
  }, [webRTC.remoteStream, inRoom]);

  // Tab visibility refresh listener
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refetch();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refetch]);

  // Server-synchronized timer counting down to endsAt
  useEffect(() => {
    if (!schedule?.endsAt) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const endTime = new Date(schedule.endsAt || schedule.endTime).getTime();
      const remaining = endTime - now;

      if (remaining <= 0) {
        setTimerStr('00:00 (Time Ended)');
        if (inRoom && !isEnding) {
          setIsEnding(true);
        }
      } else {
        const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((remaining % (1000 * 60)) / 1000);
        const hrs = Math.floor(remaining / (1000 * 60 * 60));
        if (hrs > 0) {
          setTimerStr(`${hrs}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`);
        } else {
          setTimerStr(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
        }
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [schedule, inRoom, isEnding]);

  // Handler to enter interview room
  const handleEnterInterview = async () => {
    try {
      if (scheduleId) {
        await startMutation.mutateAsync();
      }
      setInRoom(true);
    } catch (err) {
      console.error('Failed to start interview session', err);
      setInRoom(true);
    }
  };

  // Handler to end interview
  const handleEndInterview = async () => {
    try {
      if (scheduleId && userRole === 'recruiter') {
        await endMutation.mutateAsync();
      }
    } catch (err) {
      console.error('Error ending interview', err);
    } finally {
      if (userRole === 'recruiter') {
        navigate(`/org/interviews/feedback/${schedule?.roundId || ''}`);
      } else {
        navigate('/candidate/interviews');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
          <p className="text-slate-400 text-sm">Loading interview room setup...</p>
        </div>
      </div>
    );
  }

  // If not entered room yet, display Waiting Room
  if (!inRoom) {
    return (
      <WaitingRoom
        schedule={schedule}
        userRole={userRole}
        localStream={webRTC.localStream}
        isAudioMuted={webRTC.isAudioMuted}
        isVideoMuted={webRTC.isVideoMuted}
        mediaError={webRTC.mediaError}
        activeParticipants={webRTC.activeParticipants}
        onToggleAudio={webRTC.toggleAudio}
        onToggleVideo={webRTC.toggleVideo}
        onRetryMedia={webRTC.retryConnection}
        onEnterInterview={handleEnterInterview}
        onEndInterview={handleEndInterview}
      />
    );
  }

  const candidateName = schedule?.candidate?.fullName || 'Candidate';
  const interviewerName = schedule?.interviewers?.[0]?.fullName || 'Interviewer';
  const remoteUserName = userRole === 'candidate' ? interviewerName : candidateName;
  const localUserName = userRole === 'candidate' ? candidateName : interviewerName;

  const connState = webRTC.peerConnectionState;

  return (
    <div className="h-screen bg-slate-950 text-white flex flex-col overflow-hidden select-none">
      {/* Top Header */}
      <header className="h-14 bg-slate-900/90 border-b border-slate-800 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-bold text-base tracking-tight text-slate-100">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            <span>Talvix Native Interview</span>
          </div>
          <span className="text-xs text-slate-400 hidden sm:inline">
            | {schedule?.job?.title || 'Technical Session'}
          </span>
        </div>

        {/* Center: Server Synchronized Timer */}
        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3.5 py-1 rounded-full text-xs font-mono font-semibold text-slate-200">
          <Clock className="w-3.5 h-3.5 text-indigo-400" />
          <span>{timerStr}</span>
        </div>

        {/* Right: Connection State Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-xs font-medium">
            <span
              className={`w-2 h-2 rounded-full ${
                connState === 'connected'
                  ? 'bg-emerald-400'
                  : connState === 'connecting'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-red-400'
              }`}
            />
            <span className="capitalize">{connState}</span>
          </div>
        </div>
      </header>

      {/* Main Video View */}
      <main className="flex-1 p-4 grid grid-cols-1 md:grid-cols-2 gap-4 relative min-h-0 bg-slate-950">
        {/* Remote Video Tile (Other Participant) */}
        <div className="relative bg-slate-900 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center shadow-2xl min-h-0">
          {webRTC.remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-center p-6 space-y-3">
              <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
                <UserCheck className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">{remoteUserName}</p>
                <p className="text-xs text-slate-400">Waiting for remote video connection...</p>
              </div>
            </div>
          )}

          {/* Remote User Label */}
          <div className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur px-3 py-1 rounded-md text-xs font-medium border border-slate-800 flex items-center gap-2">
            <span>{remoteUserName}</span>
          </div>
        </div>

        {/* Local Video Tile (Self) */}
        <div className="relative bg-slate-900 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center shadow-2xl min-h-0">
          {webRTC.localStream && !webRTC.isVideoMuted ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />
          ) : (
            <div className="text-center p-6 space-y-3">
              <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
                <CameraOff className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">{localUserName} (You)</p>
                <p className="text-xs text-slate-400">Camera is off</p>
              </div>
            </div>
          )}

          {/* Local User Label */}
          <div className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur px-3 py-1 rounded-md text-xs font-medium border border-slate-800 flex items-center gap-2">
            <span>{localUserName} (You)</span>
            {webRTC.isAudioMuted && <MicOff className="w-3.5 h-3.5 text-red-400" />}
          </div>
        </div>
      </main>

      {/* Bottom Control Bar */}
      <footer className="h-20 bg-slate-900 border-t border-slate-800 px-6 flex items-center justify-center gap-4 shrink-0">
        <button
          type="button"
          onClick={webRTC.toggleAudio}
          className={`p-3.5 rounded-full transition flex items-center justify-center ${
            webRTC.isAudioMuted
              ? 'bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30'
              : 'bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700'
          }`}
          title={webRTC.isAudioMuted ? 'Unmute Mic' : 'Mute Mic'}
        >
          {webRTC.isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        <button
          type="button"
          onClick={webRTC.toggleVideo}
          className={`p-3.5 rounded-full transition flex items-center justify-center ${
            webRTC.isVideoMuted
              ? 'bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30'
              : 'bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700'
          }`}
          title={webRTC.isVideoMuted ? 'Turn Camera On' : 'Turn Camera Off'}
        >
          {webRTC.isVideoMuted ? <CameraOff className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
        </button>

        {connState === 'failed' || connState === 'disconnected' ? (
          <button
            type="button"
            onClick={webRTC.retryConnection}
            className="p-3.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 hover:bg-amber-500/30 transition flex items-center justify-center"
            title="Reconnect WebRTC"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        ) : null}

        <button
          type="button"
          onClick={handleEndInterview}
          className="px-6 py-3.5 rounded-full bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition flex items-center gap-2 shadow-lg shadow-red-600/30 cursor-pointer ml-4"
        >
          <PhoneOff className="w-5 h-5" />
          <span>{userRole === 'recruiter' ? 'End Interview' : 'Leave Call'}</span>
        </button>
      </footer>
    </div>
  );
};
