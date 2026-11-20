import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errorHandler';
import type { AdminAuditLog, PhoneRegistryEntry, UserProfile } from '../types/chat';
import {
  MAX_ACCOUNTS_PER_PHONE,
  getCanonicalPhoneKey,
  hashPhoneForRegistry,
  validateMobileNumber,
} from '../utils/phoneUtils';

const REGISTRY_SUPER_ADMIN_EMAIL = 'chinisdramaorg@gmail.com';

async function logPhoneRegistryAdminAction(
  action: AdminAuditLog['action'],
  details: string,
  adminEmail: string,
  targetId?: string,
  targetName?: string
): Promise<void> {
  const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  try {
    const cleanAdmin = (adminEmail || REGISTRY_SUPER_ADMIN_EMAIL).trim().slice(0, 150) || REGISTRY_SUPER_ADMIN_EMAIL;
    const cleanDetails = (details || action).trim().slice(0, 1000) || action;
    const logEntry: Record<string, unknown> = {
      id: logId,
      adminEmail: cleanAdmin,
      action: action.slice(0, 100),
      details: cleanDetails,
      timestamp: new Date().toISOString(),
    };
    const cleanTargetId = targetId?.trim().slice(0, 128);
    const cleanTargetName = targetName?.trim().slice(0, 150);
    if (cleanTargetId) logEntry.targetId = cleanTargetId;
    if (cleanTargetName) logEntry.targetName = cleanTargetName;
    await setDoc(doc(db, 'admin_logs', logId), logEntry as unknown as AdminAuditLog);
  } catch (err) {
    console.warn('Phone registry audit log notice:', err);
  }
}

export type PhoneLimitErrorCode =
  | 'INVALID_PHONE'
  | 'PHONE_LIMIT_REACHED'
  | 'PHONE_BLOCKED_BY_BAN'
  | 'PHONE_MANUALLY_BLOCKED';

export class PhoneLimitError extends Error {
  code: PhoneLimitErrorCode;
  usedSlots?: number;
  maxLimit?: number;

  constructor(
    code: PhoneLimitErrorCode,
    message: string,
    usedSlots?: number,
    maxLimit?: number
  ) {
    super(message);
    this.name = 'PhoneLimitError';
    this.code = code;
    this.usedSlots = usedSlots;
    this.maxLimit = maxLimit;
  }
}

export function formatPhoneLimitError(
  err: unknown,
  language: 'en' | 'bn' | string = 'en'
): string | null {
  if (err instanceof PhoneLimitError) {
    switch (err.code) {
      case 'PHONE_LIMIT_REACHED': {
        const limit = err.maxLimit || MAX_ACCOUNTS_PER_PHONE;
        return language === 'bn'
          ? `এই মোবাইল নম্বর দিয়ে ইতিমধ্যেই সর্বোচ্চ ${limit}টি অ্যাকাউন্ট খোলা হয়ে গেছে। নিরাপত্তার স্বার্থে নতুন অ্যাকাউন্টে অন্য মোবাইল নম্বর ব্যবহার করুন।`
          : `Maximum limit reached (${limit}/${limit} accounts) for this mobile number. Please use a different mobile number.`;
      }
      case 'PHONE_BLOCKED_BY_BAN':
        return language === 'bn'
          ? 'এই মোবাইল নম্বরের অধীনে থাকা একটি অ্যাকাউন্ট সাসপেন্ড/ব্যান রয়েছে। তাই এই নম্বর দিয়ে নতুন অ্যাকাউন্ট খোলা বা যুক্ত করা সাময়িকভাবে বন্ধ আছে।'
          : 'An account linked to this mobile number is currently suspended, so new accounts cannot be registered with this number.';
      case 'PHONE_MANUALLY_BLOCKED':
        return language === 'bn'
          ? 'নিরাপত্তা নীতির কারণে অ্যাডমিন এই মোবাইল নম্বরটি ব্লক করে রেখেছেন। সহায়তার জন্য সাপোর্ট ডেস্কে যোগাযোগ করুন।'
          : 'This mobile number has been blocked by the administrator for security reasons.';
      case 'INVALID_PHONE':
        return err.message;
    }
  }
  return null;
}

export interface PhoneSlotStatus {
  phoneHash: string;
  usedSlots: number;
  maxLimit: number;
  isBlocked: boolean;
  manualBlock: boolean;
  blockedReason?: string | null;
  containsUid: (uid?: string | null) => boolean;
}

export async function getPhoneSlotStatus(rawPhone?: string | null): Promise<PhoneSlotStatus | null> {
  const phoneHash = await hashPhoneForRegistry(rawPhone);
  if (!phoneHash) return null;

  try {
    const snap = await getDoc(doc(db, 'phone_registry', phoneHash));
    if (!snap.exists()) {
      return {
        phoneHash,
        usedSlots: 0,
        maxLimit: MAX_ACCOUNTS_PER_PHONE,
        isBlocked: false,
        manualBlock: false,
        containsUid: () => false,
      };
    }
    const data = snap.data() as PhoneRegistryEntry;
    const uids = Array.isArray(data.accountUids) ? data.accountUids : [];
    const maxLimit =
      typeof data.maxLimit === 'number' && data.maxLimit >= 1 ? data.maxLimit : MAX_ACCOUNTS_PER_PHONE;
    return {
      phoneHash,
      usedSlots: uids.length,
      maxLimit,
      isBlocked: Boolean(data.isBlocked || (data.bannedUids && data.bannedUids.length > 0)),
      manualBlock: Boolean(data.manualBlock),
      blockedReason: data.blockedReason || null,
      containsUid: (uid?: string | null) => Boolean(uid && uids.includes(uid)),
    };
  } catch {
    return null;
  }
}

export async function claimPhoneSlot(
  uid: string,
  rawPhone: string,
  language: 'en' | 'bn' | string = 'en'
): Promise<{ phoneHash: string; normalizedPhone: string; usedSlots: number; maxLimit: number }> {
  const validation = validateMobileNumber(rawPhone, language);
  if (!validation.valid) {
    throw new PhoneLimitError('INVALID_PHONE', validation.error || 'Invalid mobile number.');
  }

  const phoneHash = await hashPhoneForRegistry(validation.normalized);
  if (!phoneHash) {
    throw new PhoneLimitError(
      'INVALID_PHONE',
      language === 'bn' ? 'সঠিক মোবাইল নম্বর দিন।' : 'Please enter a valid mobile number.'
    );
  }

  const regRef = doc(db, 'phone_registry', phoneHash);
  const nowIso = new Date().toISOString();

  const result = await runTransaction(db, async (tx) => {
    const snap = await tx.get(regRef);
    if (!snap.exists()) {
      const entry: PhoneRegistryEntry = {
        phoneHash,
        accountUids: [uid],
        maxLimit: MAX_ACCOUNTS_PER_PHONE,
        isBlocked: false,
        manualBlock: false,
        bannedUids: [],
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      tx.set(regRef, entry);
      return { usedSlots: 1, maxLimit: MAX_ACCOUNTS_PER_PHONE };
    }

    const data = snap.data() as PhoneRegistryEntry;
    const uids = Array.isArray(data.accountUids) ? data.accountUids : [];
    const bannedUids = Array.isArray(data.bannedUids) ? data.bannedUids : [];
    const releasedUids = Array.isArray(data.manuallyReleasedUids) ? data.manuallyReleasedUids : [];
    const limit =
      typeof data.maxLimit === 'number' && data.maxLimit >= 1 ? data.maxLimit : MAX_ACCOUNTS_PER_PHONE;

    if (uids.includes(uid)) {
      return { usedSlots: uids.length, maxLimit: limit };
    }

    if (data.manualBlock) {
      throw new PhoneLimitError(
        'PHONE_MANUALLY_BLOCKED',
        language === 'bn'
          ? 'নিরাপত্তা নীতির কারণে অ্যাডমিন এই মোবাইল নম্বরটি ব্লক করে রেখেছেন।'
          : 'This mobile number has been blocked by the administrator.'
      );
    }

    if (data.isBlocked || bannedUids.length > 0) {
      throw new PhoneLimitError(
        'PHONE_BLOCKED_BY_BAN',
        language === 'bn'
          ? 'এই মোবাইল নম্বরের অধীনে থাকা একটি অ্যাকাউন্ট সাসপেন্ড রয়েছে, তাই নতুন অ্যাকাউন্ট খোলা যাবে না।'
          : 'An account linked to this mobile number is currently suspended, so new accounts are blocked.'
      );
    }

    if (uids.length >= limit) {
      throw new PhoneLimitError(
        'PHONE_LIMIT_REACHED',
        language === 'bn'
          ? `এই মোবাইল নম্বর দিয়ে ইতিমধ্যেই সর্বোচ্চ ${limit}টি অ্যাকাউন্ট খোলা হয়েছে।`
          : `Maximum limit of ${limit} accounts reached for this mobile number.`,
        uids.length,
        limit
      );
    }

    const nextUids = [...uids, uid];
    const updatePayload: Record<string, unknown> = {
      accountUids: nextUids,
      updatedAt: nowIso,
    };
    if (releasedUids.includes(uid)) {
      updatePayload.manuallyReleasedUids = releasedUids.filter((id) => id !== uid);
    }
    tx.update(regRef, updatePayload);
    return { usedSlots: nextUids.length, maxLimit: limit };
  });

  return {
    phoneHash,
    normalizedPhone: validation.normalized,
    usedSlots: result.usedSlots,
    maxLimit: result.maxLimit,
  };
}

export async function releasePhoneSlot(uid: string, rawPhone?: string | null): Promise<void> {
  const phoneHash = await hashPhoneForRegistry(rawPhone);
  if (!phoneHash) return;

  const regRef = doc(db, 'phone_registry', phoneHash);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(regRef);
      if (!snap.exists()) return;

      const data = snap.data() as PhoneRegistryEntry;
      const uids = Array.isArray(data.accountUids) ? data.accountUids : [];
      const bannedUids = Array.isArray(data.bannedUids) ? data.bannedUids : [];
      if (!uids.includes(uid) || bannedUids.includes(uid)) return;

      tx.update(regRef, {
        accountUids: uids.filter((id) => id !== uid),
        updatedAt: new Date().toISOString(),
      });
    });
  } catch (err) {
    console.warn('Phone slot release notice:', err);
  }
}

export async function switchPhoneSlot(
  uid: string,
  oldPhone: string | null | undefined,
  newPhone: string,
  language: 'en' | 'bn' | string = 'en'
): Promise<{ phoneHash: string; normalizedPhone: string }> {
  const validation = validateMobileNumber(newPhone, language);
  if (!validation.valid) {
    throw new PhoneLimitError('INVALID_PHONE', validation.error || 'Invalid mobile number.');
  }

  const oldKey = getCanonicalPhoneKey(oldPhone);
  const newKey = validation.canonicalKey;

  if (oldKey && newKey && oldKey === newKey) {
    const claimed = await claimPhoneSlot(uid, validation.normalized, language);
    return { phoneHash: claimed.phoneHash, normalizedPhone: claimed.normalizedPhone };
  }

  // First claim the new phone slot (throws BEFORE releasing old slot if new phone is full/blocked)
  const claimed = await claimPhoneSlot(uid, validation.normalized, language);

  if (oldPhone) {
    await releasePhoneSlot(uid, oldPhone);
  }

  return { phoneHash: claimed.phoneHash, normalizedPhone: claimed.normalizedPhone };
}

/**
 * Self-heals legacy existing accounts into phone_registry on login if not yet indexed.
 */
export async function ensureExistingUserPhoneInRegistry(
  uid: string,
  rawPhone?: string | null,
  isBanned?: boolean
): Promise<void> {
  if (isBanned) return;
  const phoneHash = await hashPhoneForRegistry(rawPhone);
  if (!phoneHash) return;

  const regRef = doc(db, 'phone_registry', phoneHash);
  const nowIso = new Date().toISOString();
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(regRef);
      if (!snap.exists()) {
        tx.set(regRef, {
          phoneHash,
          accountUids: [uid],
          maxLimit: MAX_ACCOUNTS_PER_PHONE,
          isBlocked: false,
          manualBlock: false,
          bannedUids: [],
          createdAt: nowIso,
          updatedAt: nowIso,
        });
        return;
      }
      const data = snap.data() as PhoneRegistryEntry;
      const uids = Array.isArray(data.accountUids) ? data.accountUids : [];
      const releasedUids = Array.isArray(data.manuallyReleasedUids) ? data.manuallyReleasedUids : [];
      const limit =
        typeof data.maxLimit === 'number' && data.maxLimit >= 1 ? data.maxLimit : MAX_ACCOUNTS_PER_PHONE;
      if (
        !uids.includes(uid) &&
        !releasedUids.includes(uid) &&
        !data.isBlocked &&
        !data.manualBlock &&
        uids.length < limit
      ) {
        tx.update(regRef, {
          accountUids: [...uids, uid],
          updatedAt: nowIso,
        });
      }
    });
  } catch {
    // Non-blocking best-effort sync for legacy profiles
  }
}

/**
 * Syncs Admin ban/unban state onto the user's phone_registry record so a banned account
 * locks the phone number against creating new accounts.
 */
export async function syncBanStateToPhoneRegistry(
  uid: string,
  rawPhone: string | undefined | null,
  isBanned: boolean
): Promise<void> {
  const phoneHash = await hashPhoneForRegistry(rawPhone);
  if (!phoneHash) return;

  const regRef = doc(db, 'phone_registry', phoneHash);
  const nowIso = new Date().toISOString();
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(regRef);
      if (!snap.exists()) {
        if (!isBanned) return;
        tx.set(regRef, {
          phoneHash,
          accountUids: [uid],
          maxLimit: MAX_ACCOUNTS_PER_PHONE,
          isBlocked: true,
          manualBlock: false,
          blockedReason: 'Suspended account under this mobile number',
          bannedUids: [uid],
          createdAt: nowIso,
          updatedAt: nowIso,
        });
        return;
      }

      const data = snap.data() as PhoneRegistryEntry;
      const uids = Array.isArray(data.accountUids) ? data.accountUids : [];
      const bannedUids = Array.isArray(data.bannedUids) ? data.bannedUids : [];

      if (isBanned) {
        const nextUids = uids.includes(uid) ? uids : [...uids.slice(0, 9), uid];
        const nextBanned = bannedUids.includes(uid) ? bannedUids : [...bannedUids.slice(0, 9), uid];
        tx.update(regRef, {
          accountUids: nextUids,
          bannedUids: nextBanned,
          isBlocked: true,
          blockedReason:
            data.manualBlock && data.blockedReason
              ? data.blockedReason
              : 'Suspended account under this mobile number',
          updatedAt: nowIso,
        });
      } else {
        const nextBanned = bannedUids.filter((id) => id !== uid);
        const stillBlocked = nextBanned.length > 0 || Boolean(data.manualBlock);
        tx.update(regRef, {
          bannedUids: nextBanned,
          isBlocked: stillBlocked,
          blockedReason: stillBlocked
            ? data.blockedReason || 'Blocked by administrator'
            : null,
          updatedAt: nowIso,
        });
      }
    });
  } catch (err) {
    console.warn('Phone registry ban sync notice:', err);
  }
}

/**
 * Self-clears an expired temporary ban from phone_registry once users/{uid}.isBanned == false.
 */
export async function clearExpiredSelfBanFromPhoneRegistry(
  uid: string,
  rawPhone?: string | null
): Promise<void> {
  const phoneHash = await hashPhoneForRegistry(rawPhone);
  if (!phoneHash) return;

  const regRef = doc(db, 'phone_registry', phoneHash);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(regRef);
      if (!snap.exists()) return;
      const data = snap.data() as PhoneRegistryEntry;
      const bannedUids = Array.isArray(data.bannedUids) ? data.bannedUids : [];
      if (!bannedUids.includes(uid)) return;

      const nextBanned = bannedUids.filter((id) => id !== uid);
      const nextBlocked = nextBanned.length > 0 || Boolean(data.manualBlock);
      tx.update(regRef, {
        bannedUids: nextBanned,
        isBlocked: nextBlocked,
        blockedReason: nextBlocked ? data.blockedReason || 'Blocked by administrator' : null,
        updatedAt: new Date().toISOString(),
      });
    });
  } catch (err) {
    console.warn('Clear expired self-ban phone registry notice:', err);
  }
}

// ------------------------------------------------------------------
// SUPER ADMIN PHONE QUOTA & SLOT MANAGEMENT
// ------------------------------------------------------------------

export function subscribeToPhoneRegistries(
  callback: (entries: PhoneRegistryEntry[]) => void
): Unsubscribe {
  const path = 'phone_registry';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list = snapshot.docs.map((d) => d.data() as PhoneRegistryEntry);
      callback(list);
    },
    (error) => {
      console.warn('Phone registry subscription notice:', error);
    }
  );
}

/**
 * Populates missing phone_registry entries and reconciles existing phone_registry documents:
 * - Adds active accounts missing from accountUids (unless manually released by admin)
 * - Prunes permanently deleted, expired-deletion, orphan (non-existent), duplicate, or phone-changed UIDs
 * - Preserves banned UID locks and admin manual slot removals
 */
export async function backfillPhoneRegistryFromUsers(users: UserProfile[]): Promise<void> {
  try {
    const grouped = new Map<string, { uids: string[]; bannedUids: string[] }>();
    const userById = new Map<string, UserProfile>();
    const userPhoneHashById = new Map<string, string>();
    const deletedUnbannedUids = new Set<string>();
    const nowMs = Date.now();

    const sortedUsers = [...users].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
      return (Number.isFinite(ta) ? ta : Number.MAX_SAFE_INTEGER) - (Number.isFinite(tb) ? tb : Number.MAX_SAFE_INTEGER);
    });

    for (const u of sortedUsers) {
      userById.set(u.userId, u);
      const isExpiredScheduled =
        u.status === 'scheduled_for_deletion' &&
        Boolean(u.deleteScheduledAt) &&
        Number.isFinite(new Date(u.deleteScheduledAt!).getTime()) &&
        new Date(u.deleteScheduledAt!).getTime() <= nowMs;

      if ((u.status === 'deleted' || isExpiredScheduled) && !u.isBanned) {
        deletedUnbannedUids.add(u.userId);
        continue;
      }

      const phoneHash = await hashPhoneForRegistry(u.phoneNumber);
      if (!phoneHash) continue;
      userPhoneHashById.set(u.userId, phoneHash);

      const bucket = grouped.get(phoneHash) || { uids: [], bannedUids: [] };
      if (!bucket.uids.includes(u.userId) && bucket.uids.length < 10) {
        bucket.uids.push(u.userId);
      }
      if (u.isBanned && !bucket.bannedUids.includes(u.userId) && bucket.bannedUids.length < 10) {
        bucket.bannedUids.push(u.userId);
      }
      grouped.set(phoneHash, bucket);
    }

    const existingSnap = await getDocs(collection(db, 'phone_registry'));
    const existingMap = new Map<string, PhoneRegistryEntry>();
    existingSnap.forEach((d) => existingMap.set(d.id, d.data() as PhoneRegistryEntry));

    const nowIso = new Date().toISOString();

    // 1. Create missing registry documents & reconcile existing ones for all active user phone groups
    for (const [phoneHash, bucket] of grouped.entries()) {
      const existing = existingMap.get(phoneHash);
      if (!existing) {
        const entry: PhoneRegistryEntry = {
          phoneHash,
          accountUids: bucket.uids,
          maxLimit: Math.min(10, Math.max(MAX_ACCOUNTS_PER_PHONE, bucket.uids.length)),
          isBlocked: bucket.bannedUids.length > 0,
          manualBlock: false,
          ...(bucket.bannedUids.length > 0
            ? { blockedReason: 'Suspended account under this mobile number' }
            : {}),
          bannedUids: bucket.bannedUids,
          manuallyReleasedUids: [],
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        await runTransaction(db, async (tx) => {
          const check = await tx.get(doc(db, 'phone_registry', phoneHash));
          if (!check.exists()) {
            tx.set(doc(db, 'phone_registry', phoneHash), entry);
          }
        }).catch(() => {});
      } else {
        await runTransaction(db, async (tx) => {
          const regRef = doc(db, 'phone_registry', phoneHash);
          const snap = await tx.get(regRef);
          if (!snap.exists()) return;

          const cur = snap.data() as PhoneRegistryEntry;
          const curUids = Array.isArray(cur.accountUids) ? cur.accountUids : [];
          const releasedUids = Array.isArray(cur.manuallyReleasedUids) ? cur.manuallyReleasedUids : [];
          const curBanned = Array.isArray(cur.bannedUids) ? cur.bannedUids : [];
          const curLimit =
            typeof cur.maxLimit === 'number' && cur.maxLimit >= 1 ? cur.maxLimit : MAX_ACCOUNTS_PER_PHONE;

          // Keep only UIDs that either belong to this phoneHash currently OR are actively banned
          const cleanedCurUids: string[] = [];
          for (const id of curUids) {
            if (cleanedCurUids.includes(id)) continue;
            if (deletedUnbannedUids.has(id)) continue;
            const owner = userById.get(id);
            const isBannedHere = curBanned.includes(id) || Boolean(owner?.isBanned);
            if (!owner && !isBannedHere) continue; // Orphan / removed user doc
            if (owner && !isBannedHere && userPhoneHashById.get(id) !== phoneHash) continue; // User moved off this number
            cleanedCurUids.push(id);
          }

          const missingActiveUids = bucket.uids.filter(
            (id) => !cleanedCurUids.includes(id) && !releasedUids.includes(id)
          );
          const nextUids = [...cleanedCurUids, ...missingActiveUids].slice(0, 10);
          const nextMaxLimit = Math.min(10, Math.max(curLimit, nextUids.length));

          const trackedBanned = bucket.bannedUids.filter((id) => nextUids.includes(id));
          const missingBanned = trackedBanned.filter((id) => !curBanned.includes(id));

          const uidsChanged =
            nextUids.length !== curUids.length ||
            nextUids.some((id, idx) => curUids[idx] !== id);
          const limitChanged = nextMaxLimit !== curLimit;
          const bansChanged = missingBanned.length > 0;

          if (!uidsChanged && !limitChanged && !bansChanged) return;

          const updates: Record<string, unknown> = {
            updatedAt: nowIso,
          };
          if (uidsChanged) {
            updates.accountUids = nextUids;
          }
          if (limitChanged) {
            updates.maxLimit = nextMaxLimit;
          }
          if (bansChanged) {
            updates.bannedUids = [...curBanned, ...missingBanned].slice(0, 10);
            updates.isBlocked = true;
            updates.blockedReason =
              cur.blockedReason || 'Suspended account under this mobile number';
          }

          tx.update(regRef, updates);
        }).catch(() => {});
      }
    }

    // 2. Also prune stale/orphan UIDs from any existing phone_registry entry that has 0 active holders left
    for (const [phoneHash, existing] of existingMap.entries()) {
      if (grouped.has(phoneHash)) continue;
      const curUids = Array.isArray(existing.accountUids) ? existing.accountUids : [];
      if (curUids.length === 0) continue;
      const curBanned = Array.isArray(existing.bannedUids) ? existing.bannedUids : [];
      const cleaned = curUids.filter((id, idx) => {
        if (curUids.indexOf(id) !== idx) return false;
        const owner = userById.get(id);
        const isBannedHere = curBanned.includes(id) || Boolean(owner?.isBanned);
        if (isBannedHere) return true;
        return Boolean(owner && !deletedUnbannedUids.has(id) && userPhoneHashById.get(id) === phoneHash);
      });
      if (cleaned.length !== curUids.length) {
        await runTransaction(db, async (tx) => {
          tx.update(doc(db, 'phone_registry', phoneHash), {
            accountUids: cleaned,
            updatedAt: nowIso,
          });
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('Phone registry backfill notice:', err);
  }
}

export async function adminSetPhoneManualBlock(
  phoneHash: string,
  blocked: boolean,
  reason: string,
  adminEmail: string,
  displayPhone?: string
): Promise<void> {
  const path = `phone_registry/${phoneHash}`;
  const cleanAdmin = (adminEmail || REGISTRY_SUPER_ADMIN_EMAIL).trim().slice(0, 150);
  const cleanReason = (reason || (blocked ? 'Blocked by administrator' : '')).trim().slice(0, 300);

  try {
    await runTransaction(db, async (tx) => {
      const ref = doc(db, 'phone_registry', phoneHash);
      const snap = await tx.get(ref);
      const nowIso = new Date().toISOString();

      if (!snap.exists()) {
        tx.set(ref, {
          phoneHash,
          accountUids: [],
          maxLimit: MAX_ACCOUNTS_PER_PHONE,
          isBlocked: blocked,
          manualBlock: blocked,
          blockedReason: blocked ? cleanReason || 'Blocked by administrator' : null,
          bannedUids: [],
          createdAt: nowIso,
          updatedAt: nowIso,
        });
        return;
      }

      const data = snap.data() as PhoneRegistryEntry;
      const bannedUids = Array.isArray(data.bannedUids) ? data.bannedUids : [];
      const nextBlocked = blocked || bannedUids.length > 0;
      const nextReason = blocked
        ? cleanReason || 'Blocked by administrator'
        : bannedUids.length > 0
        ? 'Suspended account under this mobile number'
        : null;

      tx.update(ref, {
        manualBlock: blocked,
        isBlocked: nextBlocked,
        blockedReason: nextReason,
        updatedAt: nowIso,
      });
    });

    await logPhoneRegistryAdminAction(
      blocked ? 'block_phone_number' : 'unblock_phone_number',
      `${blocked ? 'Manually locked' : 'Removed manual lock on'} mobile registry (${displayPhone || phoneHash.slice(0, 12)}).${
        cleanReason ? ` Note: ${cleanReason}` : ''
      }`.slice(0, 1000),
      cleanAdmin,
      phoneHash.slice(0, 128),
      displayPhone || `Phone#${phoneHash.slice(0, 8)}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminRemoveUidFromPhoneRegistry(
  phoneHash: string,
  targetUid: string,
  adminEmail: string,
  displayPhone?: string
): Promise<void> {
  const path = `phone_registry/${phoneHash}`;
  const cleanAdmin = (adminEmail || REGISTRY_SUPER_ADMIN_EMAIL).trim().slice(0, 150);

  try {
    await runTransaction(db, async (tx) => {
      const ref = doc(db, 'phone_registry', phoneHash);
      const snap = await tx.get(ref);
      if (!snap.exists()) return;

      const data = snap.data() as PhoneRegistryEntry;
      const nextUids = (Array.isArray(data.accountUids) ? data.accountUids : []).filter(
        (id) => id !== targetUid
      );
      const nextBanned = (Array.isArray(data.bannedUids) ? data.bannedUids : []).filter(
        (id) => id !== targetUid
      );
      const curReleased = Array.isArray(data.manuallyReleasedUids) ? data.manuallyReleasedUids : [];
      const nextReleased = curReleased.includes(targetUid)
        ? curReleased
        : [...curReleased.slice(-9), targetUid];
      const nextBlocked = nextBanned.length > 0 || Boolean(data.manualBlock);

      tx.update(ref, {
        accountUids: nextUids,
        bannedUids: nextBanned,
        manuallyReleasedUids: nextReleased,
        isBlocked: nextBlocked,
        blockedReason: nextBlocked
          ? data.blockedReason || 'Blocked by administrator'
          : null,
        updatedAt: new Date().toISOString(),
      });
    });

    await logPhoneRegistryAdminAction(
      'manage_phone_slots',
      `Released UID ${targetUid} from phone registry (${displayPhone || phoneHash.slice(0, 12)}).`.slice(0, 1000),
      cleanAdmin,
      targetUid,
      displayPhone || `Phone#${phoneHash.slice(0, 8)}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminUpdatePhoneMaxLimit(
  phoneHash: string,
  newLimit: number,
  adminEmail: string,
  displayPhone?: string
): Promise<void> {
  const safeLimit = Math.min(10, Math.max(1, Math.round(newLimit)));
  const path = `phone_registry/${phoneHash}`;
  const cleanAdmin = (adminEmail || REGISTRY_SUPER_ADMIN_EMAIL).trim().slice(0, 150);

  try {
    await runTransaction(db, async (tx) => {
      const ref = doc(db, 'phone_registry', phoneHash);
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      tx.update(ref, {
        maxLimit: safeLimit,
        updatedAt: new Date().toISOString(),
      });
    });

    await logPhoneRegistryAdminAction(
      'manage_phone_slots',
      `Updated max account limit to ${safeLimit} for phone registry (${displayPhone || phoneHash.slice(0, 12)}).`.slice(
        0,
        1000
      ),
      cleanAdmin,
      phoneHash.slice(0, 128),
      displayPhone || `Phone#${phoneHash.slice(0, 8)}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
