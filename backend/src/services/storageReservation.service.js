import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Document } from '../models/Document.js';
import { StorageReservation } from '../models/StorageReservation.js';
import { UserStorageUsage } from '../models/UserStorageUsage.js';
import { AppError } from '../shared/errors/AppError.js';

const retained = ['active', 'archived', 'quarantined', 'replaced'];
const quotaBytes = () => env.FILE_MAX_USER_STORAGE_MB * 1024 * 1024;
const requireTransactions = () => {
  const type = mongoose.connection.client?.topology?.description?.type;
  if (!['ReplicaSetWithPrimary', 'Sharded'].includes(type)) throw new AppError('Storage reservations require MongoDB transaction support', 503, 'STORAGE_RESERVATION_FAILED');
};
const aggregateUsage = async (user, session) => {
  const [row] = await Document.aggregate([{ $match: { owner: new mongoose.Types.ObjectId(user), status: { $in: retained } } }, { $group: { _id: null, usedBytes: { $sum: '$sizeBytes' }, documentCount: { $sum: 1 } } }]).session(session);
  return { usedBytes: row?.usedBytes ?? 0, documentCount: row?.documentCount ?? 0 };
};
const ensureUsage = async (user, session) => {
  let usage = await UserStorageUsage.findOne({ user }).session(session);
  if (!usage) { const totals = await aggregateUsage(user, session); [usage] = await UserStorageUsage.create([{ user, ...totals }], { session }); }
  return usage;
};

export const reserveStorage = async ({ user, uploadSession, bytes, expiresAt }) => {
  requireTransactions();
  const existing = await StorageReservation.findOne({ uploadSession });
  if (existing) {
    if (existing.user.equals(user) && existing.bytes === bytes && existing.status === 'reserved' && existing.expiresAt > new Date()) return existing;
    throw new AppError('Storage reservation is unavailable', 409, 'STORAGE_RESERVATION_FAILED');
  }
  const session = await mongoose.startSession();
  try {
    let reservation;
    await session.withTransaction(async () => {
      await ensureUsage(user, session);
      const usage = await UserStorageUsage.findOneAndUpdate({ user, $expr: { $lte: [{ $add: ['$usedBytes', '$reservedBytes', bytes] }, quotaBytes()] } }, { $inc: { reservedBytes: bytes, reservationVersion: 1 } }, { returnDocument: 'after', session });
      if (!usage) throw new AppError('Document storage quota exceeded', 413, 'STORAGE_QUOTA_EXCEEDED');
      [reservation] = await StorageReservation.create([{ user, uploadSession, bytes, expiresAt }], { session });
    });
    return reservation;
  } catch (error) {
    if (error?.code === 11000) { const winner = await StorageReservation.findOne({ uploadSession }); if (winner?.user.equals(user) && winner.bytes === bytes) return winner; }
    throw error;
  } finally { await session.endSession(); }
};

const commitInSession = async (reservationId, session) => { let reservation = await StorageReservation.findOne({ _id: reservationId, status: 'reserved' }).session(session); if (!reservation) { reservation = await StorageReservation.findById(reservationId).session(session); if (reservation?.status === 'committed') return reservation; throw new AppError('Storage reservation expired', 409, 'STORAGE_RESERVATION_EXPIRED'); } const result = await UserStorageUsage.updateOne({ user: reservation.user, reservedBytes: { $gte: reservation.bytes } }, { $inc: { reservedBytes: -reservation.bytes, usedBytes: reservation.bytes, documentCount: 1, reservationVersion: 1 } }, { session }); if (!result.modifiedCount) throw new AppError('Storage reservation counters are inconsistent', 500, 'STORAGE_RESERVATION_FAILED'); reservation.status = 'committed'; reservation.committedAt = new Date(); await reservation.save({ session }); return reservation; };
export const commitStorageReservation = async (reservationId, externalSession) => { requireTransactions(); if (externalSession) return commitInSession(reservationId, externalSession); const session = await mongoose.startSession(); try { let reservation; await session.withTransaction(async () => { reservation = await commitInSession(reservationId, session); }); return reservation; } finally { await session.endSession(); } };

export const releaseStorageReservation = async (reservationId, status = 'released', failureCode) => {
  requireTransactions(); const session = await mongoose.startSession();
  try { let reservation; await session.withTransaction(async () => { reservation = await StorageReservation.findOne({ _id: reservationId, status: 'reserved' }).session(session); if (!reservation) return; await UserStorageUsage.updateOne({ user: reservation.user }, [{ $set: { reservedBytes: { $max: [0, { $subtract: ['$reservedBytes', reservation.bytes] }] }, reservationVersion: { $add: ['$reservationVersion', 1] } } }], { session, updatePipeline: true }); reservation.status = status; reservation.releasedAt = new Date(); reservation.failureCode = failureCode; await reservation.save({ session }); }); return reservation; } finally { await session.endSession(); }
};

export const decrementStoredUsage = async (user, bytes) => UserStorageUsage.updateOne({ user }, [{ $set: { usedBytes: { $max: [0, { $subtract: ['$usedBytes', bytes] }] }, documentCount: { $max: [0, { $subtract: ['$documentCount', 1] }] }, reservationVersion: { $add: ['$reservationVersion', 1] } } }], { updatePipeline: true });
export const expireStaleReservations = async (now = new Date()) => { const ids = await StorageReservation.find({ status: 'reserved', expiresAt: { $lte: now } }).distinct('_id'); for (const id of ids) await releaseStorageReservation(id, 'expired', 'RESERVATION_EXPIRED'); return ids.length; };
export const recalculateUserStorageUsage = async (user) => { const totals = await aggregateUsage(String(user)); const [reservationTotals] = await StorageReservation.aggregate([{ $match: { user: new mongoose.Types.ObjectId(user), status: 'reserved', expiresAt: { $gt: new Date() } } }, { $group: { _id: null, reservedBytes: { $sum: '$bytes' } } }]); return UserStorageUsage.findOneAndUpdate({ user }, { $set: { ...totals, reservedBytes: reservationTotals?.reservedBytes ?? 0 }, $setOnInsert: { reservationVersion: 0 } }, { upsert: true, returnDocument: 'after' }); };
export const recalculateAllStorageUsage = async () => { const users = await Document.distinct('owner', { status: { $in: retained } }); const results = []; for (const user of users) results.push(await recalculateUserStorageUsage(user)); return results; };
