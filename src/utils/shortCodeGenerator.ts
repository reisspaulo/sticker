import { supabase } from '../config/supabase';

// Characters to use for generating short codes (URL-safe, no ambiguous chars)
const CHARSET = 'abcdefghjkmnpqrstuvwxyz23456789';

/**
 * Generate a random short code
 * @param length Length of the code (default: 6)
 * @returns Random short code
 */
export function generateRandomCode(length: number = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * CHARSET.length);
    code += CHARSET[randomIndex];
  }
  return code;
}

/**
 * Generate a unique short code that doesn't exist in the database
 * @param maxAttempts Maximum attempts to find unique code
 * @returns Unique short code
 */
export async function generateUniqueCode(maxAttempts: number = 10): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateRandomCode();

    // Check if code already exists
    const { data, error } = await supabase
      .from('url_links')
      .select('id')
      .eq('short_code', code)
      .single();

    // If no data found (error PGRST116), the code is unique
    if (error && error.code === 'PGRST116') {
      return code;
    }

    // If data exists, try again
    if (data) {
      continue;
    }

    // If other error, throw
    if (error) {
      throw error;
    }
  }

  throw new Error(`Failed to generate unique code after ${maxAttempts} attempts`);
}

/**
 * Validate a custom short code
 * @param code Code to validate
 * @returns true if valid, false otherwise
 */
export function isValidCode(code: string): boolean {
  // Must be 3-12 characters
  if (code.length < 3 || code.length > 12) {
    return false;
  }

  // Only alphanumeric and hyphens allowed
  const validPattern = /^[a-z0-9-]+$/;
  return validPattern.test(code.toLowerCase());
}

/**
 * Check if a code is available (not already used)
 * @param code Code to check
 * @returns true if available, false if already used
 */
export async function isCodeAvailable(code: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('url_links')
    .select('id')
    .eq('short_code', code.toLowerCase())
    .single();

  // If no data found (error PGRST116), the code is available
  if (error && error.code === 'PGRST116') {
    return true;
  }

  // If data exists, code is not available
  if (data) {
    return false;
  }

  // If other error, throw
  if (error) {
    throw error;
  }

  return false;
}
