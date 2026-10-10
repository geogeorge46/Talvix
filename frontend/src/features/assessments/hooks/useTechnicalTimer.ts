import { useEffect, useState } from 'react';

export function useTechnicalTimer(expiresAt: string, onExpire?: () => void) {
  const [remainingMs, setRemainingMs] = useState(() =>
    Math.max(0, Date.parse(expiresAt) - Date.now())
  );

  useEffect(() => {
    const intervalId = setInterval(() => {
      const ms = Math.max(0, Date.parse(expiresAt) - Date.now());
      setRemainingMs(ms);
      if (ms === 0) {
        clearInterval(intervalId);
        onExpire?.();
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [expiresAt, onExpire]);

  const isExpired = remainingMs === 0;
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return {
    remainingMs,
    isExpired,
    formattedTime,
    totalSeconds,
  };
}
