export const MAX_ACCOUNTS_PER_PHONE = 3;

export interface PhoneValidationResult {
  valid: boolean;
  normalized: string;
  digits: string;
  canonicalKey: string | null;
  error?: string;
}

export function normalizePhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  return phone.trim().replace(/\s+/g, ' ').slice(0, 50);
}

export function extractPhoneDigits(phone?: string | null): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

/**
 * Canonicalizes a phone number into a consistent digit key so
 * "+880 1712-345678", "8801712345678", and "01712345678" map to the exact same key.
 */
export function getCanonicalPhoneKey(phone?: string | null): string | null {
  const digits = extractPhoneDigits(phone);
  if (digits.length < 7) return null;
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function isRepeatingOrDummyDigits(digits: string, canonical: string): boolean {
  // 1. Entire number or canonical key consists of the exact same digit (e.g. 0000000000, 1111111111)
  if (/^(\d)\1+$/.test(digits) || /^(\d)\1+$/.test(canonical)) {
    return true;
  }

  // 2. 7 or more identical digits in a row (e.g. 01700000000, 01899999999)
  if (/(\d)\1{6,}/.test(digits) || /(\d)\1{6,}/.test(canonical)) {
    return true;
  }

  // 3. Repeating 2-digit or 3-digit cycle across the entire canonical key (e.g. 1212121212, 0101010101, 1231231231)
  for (const unitLen of [2, 3]) {
    if (canonical.length >= 8) {
      const unit = canonical.slice(0, unitLen);
      const repeated = unit.repeat(Math.ceil(canonical.length / unitLen)).slice(0, canonical.length);
      if (repeated === canonical) {
        return true;
      }
    }
  }

  // 4. Long strictly ascending or descending sequential runs (>= 8 consecutive steps, e.g. 0123456789 / 9876543210)
  let ascRun = 1;
  let descRun = 1;
  for (let i = 1; i < canonical.length; i++) {
    const prev = canonical.charCodeAt(i - 1) - 48;
    const curr = canonical.charCodeAt(i) - 48;
    if (curr === prev + 1) {
      ascRun += 1;
    } else {
      ascRun = 1;
    }
    if (curr === prev - 1) {
      descRun += 1;
    } else {
      descRun = 1;
    }
    if (ascRun >= 8 || descRun >= 8) {
      return true;
    }
  }

  return false;
}

export function validateMobileNumber(
  rawPhone?: string | null,
  language: 'en' | 'bn' | string = 'en'
): PhoneValidationResult {
  const normalized = normalizePhoneNumber(rawPhone);
  const digits = extractPhoneDigits(normalized);

  if (!normalized || /[a-zA-Z@]/.test(normalized) || !/^[+\d\s\-().]+$/.test(normalized)) {
    return {
      valid: false,
      normalized,
      digits,
      canonicalKey: null,
      error:
        language === 'bn'
          ? 'মোবাইল নম্বরে কোনো অক্ষর বা অবৈধ চিহ্ন ব্যবহার করা যাবে না।'
          : 'Mobile number must contain only valid phone digits and symbols.',
    };
  }

  if (digits.length < 8 || digits.length > 15) {
    return {
      valid: false,
      normalized,
      digits,
      canonicalKey: null,
      error:
        language === 'bn'
          ? 'সঠিক মোবাইল নম্বর দিন (৮ থেকে ১৫ ডিজিটের মধ্যে হতে হবে)।'
          : 'Please enter a valid mobile number (8 to 15 digits).',
    };
  }

  // Strict Bangladesh mobile format verification when input uses BD prefix (+880 / 880 / 01)
  const looksBangladeshi =
    digits.startsWith('01') ||
    digits.startsWith('880') ||
    digits.startsWith('00880') ||
    normalized.startsWith('+880');

  if (looksBangladeshi) {
    let localBd = digits;
    if (localBd.startsWith('00880')) {
      localBd = `0${localBd.slice(5)}`;
    } else if (localBd.startsWith('880')) {
      localBd = `0${localBd.slice(3)}`;
    }
    if (!/^01[3-9]\d{8}$/.test(localBd)) {
      return {
        valid: false,
        normalized,
        digits,
        canonicalKey: null,
        error:
          language === 'bn'
            ? 'সঠিক বাংলাদেশি মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX বা +88017XXXXXXXX)।'
            : 'Please enter a valid Bangladesh mobile number (e.g. 017XXXXXXXX or +88017XXXXXXXX).',
      };
    }
  }

  const canonicalKey = getCanonicalPhoneKey(normalized);
  if (!canonicalKey || isRepeatingOrDummyDigits(digits, canonicalKey)) {
    return {
      valid: false,
      normalized,
      digits,
      canonicalKey: null,
      error:
        language === 'bn'
          ? 'ভুয়া বা ডামি মোবাইল নম্বর (যেমন 01700000000 বা 1234567890) গ্রহণযোগ্য নয়। আপনার আসল মোবাইল নম্বর দিন।'
          : 'Dummy or placeholder mobile numbers (like 01700000000 or 1234567890) are not allowed. Please enter a real mobile number.',
    };
  }

  return {
    valid: true,
    normalized,
    digits,
    canonicalKey,
  };
}

/**
 * Generates a salted SHA-256 hash specifically for the private phone_registry quota index
 * (domain-separated from directory.phoneLookupHash).
 */
export async function hashPhoneForRegistry(phone?: string | null): Promise<string | null> {
  const canonical = getCanonicalPhoneKey(phone);
  if (!canonical) return null;
  const data = new TextEncoder().encode(`anomah_phone_reg_v1:${canonical}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
