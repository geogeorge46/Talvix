import { AppError } from '../shared/errors/AppError.js';
export const normalizeTimezone=(value)=>{try{new Intl.DateTimeFormat('en-US',{timeZone:value}).format();return value;}catch{throw new AppError('Invalid IANA timezone',400);}};
export const calculateDurationMinutes=(start,end)=>Math.round((new Date(end)-new Date(start))/60000);
export const validateScheduleWindow=(start,end,{future=true,maxDays=365}={})=>{const from=new Date(start);const to=new Date(end);if(to<=from)throw new AppError('Interview end time must follow start time',400);if(future&&from<=new Date())throw new AppError('Interview must be scheduled in the future',400);if(from>Date.now()+maxDays*86400000)throw new AppError('Interview exceeds the scheduling horizon',400);return calculateDurationMinutes(from,to);};
export const checkScheduleConflicts = async (Model, { company, candidate, interviewers, startTime, endTime, excludeId, location }) => {
  const candidateConflict = await Model.exists({
    _id: { $ne: excludeId },
    candidate,
    status: { $nin: ['cancelled', 'completed'] },
    startTime: { $lt: endTime },
    endTime: { $gt: startTime }
  });
  if (candidateConflict) return 'Candidate has an overlapping interview scheduled.';

  const interviewerConflict = await Model.exists({
    _id: { $ne: excludeId },
    interviewers: { $in: interviewers },
    status: { $nin: ['cancelled', 'completed'] },
    startTime: { $lt: endTime },
    endTime: { $gt: startTime }
  });
  if (interviewerConflict) return 'One or more interviewers have an overlapping interview scheduled.';

  if (location && location.name) {
    const roomConflict = await Model.exists({
      _id: { $ne: excludeId },
      company,
      mode: 'onsite',
      'location.name': location.name,
      status: { $nin: ['cancelled', 'completed'] },
      startTime: { $lt: endTime },
      endTime: { $gt: startTime }
    });
    if (roomConflict) return `Onsite meeting room "${location.name}" is already booked for this time.`;
  }
  return null;
};
export const hasScheduleConflict = async (Model, params) => {
  const err = await checkScheduleConflicts(Model, params);
  return Boolean(err);
};
export const validateAvailability=(records,start,end)=>!records.length||records.some((record)=>record.slots.some((slot)=>slot.status==='available'&&slot.startTime<=start&&slot.endTime>=end));
