import { randomBytes } from 'node:crypto';

/**
 * Auto-generate secure meeting links for supported video provider platforms.
 */
export const generateMeetingLink = (provider, _scheduleId) => {
  const rand = randomBytes(6).toString('hex');
  switch (provider) {
    case 'google-meet':
      return `https://meet.google.com/${rand.slice(0, 3)}-${rand.slice(3, 6)}-${rand.slice(6, 9)}`;
    case 'zoom': {
      const pwd = randomBytes(5).toString('hex');
      const meetingId = Math.floor(100000000 + Math.random() * 900000000);
      return `https://zoom.us/j/${meetingId}?pwd=${pwd}`;
    }
    case 'microsoft-teams':
      return `https://teams.microsoft.com/l/meetup-join/19%3ameeting_${rand}@thread.v2`;
    default:
      return null;
  }
};
