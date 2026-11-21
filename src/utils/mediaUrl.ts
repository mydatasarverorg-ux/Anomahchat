const SAFE_IMAGE_DATA_URL_REGEX =
  /^data:image\/(jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/i;

const SAFE_AUDIO_DATA_URL_REGEX =
  /^data:audio\/[a-z0-9.+_-]+(?:;[a-z0-9=+._ -]+)*;base64,[A-Za-z0-9+/=]+$/i;

export function isSafeImageMediaUrl(url?: string | null): url is string {
  if (!url || typeof url !== 'string') return false;
  return SAFE_IMAGE_DATA_URL_REGEX.test(url.trim());
}

export function isSafeAudioMediaUrl(url?: string | null): url is string {
  if (!url || typeof url !== 'string') return false;
  return SAFE_AUDIO_DATA_URL_REGEX.test(url.trim());
}

export function getSafeAttachmentHref(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (isSafeImageMediaUrl(trimmed) || isSafeAudioMediaUrl(trimmed)) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    // Invalid URL
  }
  return null;
}
