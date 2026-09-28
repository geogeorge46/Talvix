import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Mic, MicOff, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

export interface MediaDeviceCheckProps {
  localStream: MediaStream | null;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  mediaError: string | null;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onRetry: () => void;
}

export const MediaDeviceCheck: React.FC<MediaDeviceCheckProps> = ({
  localStream,
  isAudioMuted,
  isVideoMuted,
  mediaError,
  onToggleAudio,
  onToggleVideo,
  onRetry
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudio, setSelectedAudio] = useState<string>('');
  const [selectedVideo, setSelectedVideo] = useState<string>('');

  // Attach stream to video element
  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Audio level meter
  useEffect(() => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (!audioTrack || isAudioMuted) {
      setAudioLevel(0);
      return;
    }

    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let animationId: number;

    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      source = audioContext.createMediaStreamSource(localStream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!analyser) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(100, Math.round((avg / 255) * 100 * 2.5)));
        animationId = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (err) {
      console.warn('AudioContext not supported or failed to start meter', err);
    }

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
      }
    };
  }, [localStream, isAudioMuted]);

  // Enumerate Devices
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audio = devices.filter((d) => d.kind === 'audioinput');
        const video = devices.filter((d) => d.kind === 'videoinput');
        setAudioDevices(audio);
        setVideoDevices(video);
        if (audio.length > 0 && !selectedAudio) setSelectedAudio(audio[0].deviceId);
        if (video.length > 0 && !selectedVideo) setSelectedVideo(video[0].deviceId);
      } catch (err) {
        console.warn('Could not enumerate devices', err);
      }
    };

    fetchDevices();
    navigator.mediaDevices?.addEventListener('devicechange', fetchDevices);
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', fetchDevices);
    };
  }, []);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-white max-w-lg w-full">
      <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
        <span>Camera & Microphone Check</span>
      </h3>

      {/* Video Preview Box */}
      <div className="relative aspect-video bg-slate-950 rounded-lg overflow-hidden mb-4 border border-slate-800 flex items-center justify-center">
        {mediaError ? (
          <div className="p-4 text-center">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
            <p className="text-sm text-slate-300 mb-3">{mediaError}</p>
            <button
              onClick={onRetry}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-medium inline-flex items-center gap-2 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Permission</span>
            </button>
          </div>
        ) : localStream && !isVideoMuted ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform -scale-x-100"
          />
        ) : (
          <div className="text-center p-4">
            <CameraOff className="w-12 h-12 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Camera is turned off</p>
          </div>
        )}

        {/* Video Overlay Badge */}
        <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2 border border-slate-700/50">
          {!mediaError && localStream ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Camera Ready</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Camera Error</span>
            </>
          )}
        </div>
      </div>

      {/* Mic Meter & Controls */}
      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center text-xs text-slate-400 mb-1.5 font-medium">
            <span>Microphone Level</span>
            <span>{isAudioMuted ? 'Muted' : `${audioLevel}%`}</span>
          </div>
          <div className="h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-75 ${
                isAudioMuted ? 'bg-slate-700' : 'bg-emerald-500'
              }`}
              style={{ width: `${isAudioMuted ? 0 : audioLevel}%` }}
            />
          </div>
        </div>

        {/* Toggle Buttons */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={onToggleAudio}
            disabled={!localStream}
            className={`p-3 rounded-full font-medium transition flex items-center justify-center ${
              isAudioMuted
                ? 'bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30'
                : 'bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700'
            } disabled:opacity-50`}
            title={isAudioMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <button
            type="button"
            onClick={onToggleVideo}
            disabled={!localStream}
            className={`p-3 rounded-full font-medium transition flex items-center justify-center ${
              isVideoMuted
                ? 'bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30'
                : 'bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700'
            } disabled:opacity-50`}
            title={isVideoMuted ? 'Turn Camera On' : 'Turn Camera Off'}
          >
            {isVideoMuted ? <CameraOff className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
          </button>
        </div>

        {/* Device Selectors */}
        <div className="grid grid-cols-1 gap-3 pt-3 border-t border-slate-800 text-xs">
          {videoDevices.length > 0 && (
            <div>
              <label className="block text-slate-400 font-medium mb-1">Camera Device</label>
              <select
                value={selectedVideo}
                onChange={(e) => setSelectedVideo(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-md py-1.5 px-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {videoDevices.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {audioDevices.length > 0 && (
            <div>
              <label className="block text-slate-400 font-medium mb-1">Microphone Device</label>
              <select
                value={selectedAudio}
                onChange={(e) => setSelectedAudio(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-md py-1.5 px-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {audioDevices.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `Microphone ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
