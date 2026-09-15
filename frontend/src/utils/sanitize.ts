/* ========================================
   Client-Side Sanitization — XSS Prevention
   ======================================== */

import DOMPurify from 'dompurify';

/** Strip ALL HTML tags — returns plain text only. */
export function sanitizeText(input: string): string {
  if (!input) return '';
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] }).trim();
}

/** Validate LinkedIn URL strictly. Returns normalized URL or null. */
export function validateLinkedIn(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim().toLowerCase();
  const pattern =
    /^https:\/\/(www\.)?linkedin\.com\/in\/([a-z0-9-]{3,100})\/?$/;
  const match = trimmed.match(pattern);
  if (!match) return null;
  return `https://linkedin.com/in/${match[2]}`;
}

/** Check if a URL is safe (https only). */
export function isSafeUrl(url: string): boolean {
  return /^https:\/\//i.test(url.trim());
}
