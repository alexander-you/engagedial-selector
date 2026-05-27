/**
 * Proactive Engagement Phone Selector — Phone Validation Utility
 * Version: 1.0.6
 *
 * Validates and normalizes raw phone number strings to E.164 international
 * format before they are displayed in the PCF control or written to
 * alex_proactive_engagement.
 *
 * E.164 format: "+" followed by 7–15 digits (ITU-T standard).
 * Examples of valid results: "+972542556677", "+12025550123", "+442071838750"
 */

export interface PhoneValidationResult {
  isValid: boolean;
  /** E.164 normalized number when valid (e.g. "+972542556677"), or null when invalid. */
  normalized: string | null;
}

/**
 * Validates and normalizes a phone number string.
 *
 * Normalization steps applied before validation:
 *  1. Trim leading/trailing whitespace.
 *  2. Strip formatting characters: spaces, dashes, dots, parentheses, slashes.
 *  3. Convert a leading "00" dial-out prefix to "+".
 *
 * A number is considered valid when, after normalization, it starts with "+"
 * followed by 7–15 digits. Numbers that lack a "+" prefix are flagged as
 * invalid because the country code cannot be inferred without additional context,
 * and the downstream proactive engagement process requires a fully qualified
 * international number.
 */
export function validatePhone(raw: string): PhoneValidationResult {
  const invalid: PhoneValidationResult = { isValid: false, normalized: null };

  if (!raw?.trim()) return invalid;

  // Strip common formatting characters (in a character class, no escaping needed for most)
  let cleaned = raw.trim().replace(/[\s\-.()\\]/g, "").replace(/\//g, "");

  // Convert leading international-dialling prefix "00" → "+"
  if (cleaned.startsWith("00")) {
    cleaned = "+" + cleaned.slice(2);
  }

  // Require "+" prefix — without it the country code is ambiguous
  if (!cleaned.startsWith("+")) return invalid;

  // After "+" must be 7–15 digits (ITU-T E.164 range)
  const digits = cleaned.slice(1);
  if (!/^\d{7,15}$/.test(digits)) return invalid;

  return { isValid: true, normalized: cleaned };
}
