import React, { useEffect, useState } from 'react';
import { MediaDeviceCheck } from './MediaDeviceCheck';
import { Clock, Calendar, User, Video, ShieldCheck, AlertCircle, ArrowRight, PhoneOff } from 'lucide-react';

export interface WaitingRoomProps {
  schedule: any;
  userRole: 'candidate' | 'recruiter' | 'admin';
  localStream: MediaStream | null;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  mediaError: string | null;
  activeParticipants: any[];
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onRetryMedia: () => void;
  onEnterInterview: () => void;
  onEndInterview?: () => void;
}

export const WaitingRoom: React.FC<WaitingRoomProps> = ({
  schedule,
  userRole,
  localStream,
  isAudioMuted,
  isVideoMuted,
  mediaError,
  activeParticipants,
  onToggleAudio,
  onToggleVideo,
  onRetryMedia,
  onEnterInterview,
  onEndInterview
}) => {
  const [timeLeftStr, setTimeLeftStr] = useState<string>('');
  const [canStartInterview, setCanStartInterview] = useState(false);

  useEffect(() => {
    if (!schedule?.scheduledAt && !schedule?.startTime) return;

    const updateCountdown = () => {
      const now = new Date().getTime();
      const schedTime = new Date(schedule.scheduledAt || schedule.startTime).getTime();
      const endTime = new Date(schedule.endsAt || schedule.endTime || (schedTime + 30 * 60 * 1000)).getTime();
      const joinAvailableAt = schedule.joinAvailableAt
        ? new Date(schedule.joinAvailableAt).getTime()
        : schedTime - 5 * 60 * 1000;
      const graceEndTime = endTime + 24 * 60 * 60 * 1000;

      if (now >= joinAvailableAt && now < graceEndTime) {
        setCanStartInterview(true);
        if (now >= schedTime) {
          setTimeLeftStr(now >= endTime ? 'Available (Overtime)' : 'Available Now');
        } else {
          const diff = schedTime - now;
          const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const secs = Math.floor((diff % (1000 * 60)) / 1000);
          setTimeLeftStr(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
        }
      } else if (now >= graceEndTime) {
        setCanStartInterview(false);
        setTimeLeftStr('Expired');
      } else {
        setCanStartInterview(false);
        const diff = schedTime - now;
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        const hours = Math.floor(diff / (1000 * 60 * 60));

        if (hours > 0) {
          setTimeLeftStr(`${hours}h ${mins}m ${secs}s`);
        } else {
          setTimeLeftStr(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
        }
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [schedule]);

  const candidateName = schedule?.candidate?.fullName || 'Candidate';
  const interviewerNames = schedule?.interviewers?.map((i: any) => i.fullName).join(', ') || 'Interviewer';
  const jobTitle = schedule?.job?.title || 'Technical Interview';
  const companyName = schedule?.company?.name || 'Talvix';

  const otherRoleText = userRole === 'candidate' ? 'Interviewer' : 'Candidate';
  const isOtherUserOnline = activeParticipants.some(
    (p) => (userRole === 'candidate' ? p.role === 'interviewer' : p.role === 'candidate')
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-4xl space-y-6">
        {/* Header Banner */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>Native Talvix Interview</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100">
            {jobTitle}
          </h1>
          <p className="text-sm text-slate-400">{companyName}</p>
        </div>

        {/* Info Grid & Media Check */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Left Column: Details & Presence */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6 shadow-xl">
            <div>
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
                Interview Details
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3 text-slate-300">
                  <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>
                    {schedule?.scheduledAt
                      ? new Date(schedule.scheduledAt).toLocaleDateString(undefined, {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })
                      : 'Scheduled Date'}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-slate-300">
                  <Clock className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>
                    {schedule?.scheduledAt
                      ? new Date(schedule.scheduledAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : ''}{' '}
                    ({schedule?.durationMinutes || 30} mins)
                  </span>
                </div>

                <div className="flex items-center gap-3 text-slate-300">
                  <User className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>
                    {userRole === 'candidate'
                      ? `Interviewer: ${interviewerNames}`
                      : `Candidate: ${candidateName}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Countdown Box */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 text-center">
              <span className="text-xs uppercase tracking-wider font-medium text-slate-400 block mb-1">
                Interview Starts In
              </span>
              <div className="text-3xl font-extrabold text-indigo-400 font-mono tracking-wider">
                {timeLeftStr}
              </div>
            </div>

            {/* Participant Status */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Presence Status
              </span>
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      isOtherUserOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                    }`}
                  />
                  <span className="text-sm font-medium text-slate-200">
                    {otherRoleText}
                  </span>
                </div>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
                  {isOtherUserOnline ? 'Online & Waiting' : 'Not Connected Yet'}
                </span>
              </div>
            </div>

            {/* Enter Interview Action Button */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={onEnterInterview}
                disabled={!canStartInterview}
                className={`w-full py-3.5 px-4 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition shadow-lg ${
                  canStartInterview
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer shadow-indigo-600/30'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                }`}
              >
                <span>{canStartInterview ? 'Enter Interview Room' : `Waiting for Start Time (${timeLeftStr})`}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {userRole === 'recruiter' && onEndInterview && (
                <button
                  type="button"
                  onClick={onEndInterview}
                  className="w-full py-3.5 px-4 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition bg-red-600/90 hover:bg-red-500 text-white cursor-pointer shadow-lg shadow-red-600/20 border border-red-500/30"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>End Interview & Proceed to Feedback</span>
                </button>
              )}

              {!canStartInterview && (
                <p className="text-xs text-slate-500 text-center mt-2">
                  The button will unlock automatically when the scheduled interview time is reached.
                </p>
              )}
            </div>
          </div>

          {/* Right Column: Camera / Mic Device Preview */}
          <div className="flex flex-col items-center">
            <MediaDeviceCheck
              localStream={localStream}
              isAudioMuted={isAudioMuted}
              isVideoMuted={isVideoMuted}
              mediaError={mediaError}
              onToggleAudio={onToggleAudio}
              onToggleVideo={onToggleVideo}
              onRetry={onRetryMedia}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
