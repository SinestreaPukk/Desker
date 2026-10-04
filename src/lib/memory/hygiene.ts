/**
 * Memory hygiene: security guards, duplicate detection, and contradiction resolution.
 * Enforces the strict rule: Never store passwords, card numbers or government IDs.
 */

export interface HygieneCheckResult {
  forbidden: boolean;
  reason?: string;
}

// Credit card Luhn algorithm check
function passesLuhn(digits: string): boolean {
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits.charAt(i), 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n = (n % 10) + 1;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

export function checkSensitiveInformation(text: string): HygieneCheckResult {
  // 1. Passwords / Secrets
  const passwordPattern = /\b(password|passcode|secret key|api key|pin code|auth token)\b\s*[:=is\s]+(\S+)/i;
  const pinPattern = /\b(my pin|pin number|bank pin|atm pin)\b\s*[:=is\s]*\d{4,8}\b/i;
  if (passwordPattern.test(text) || pinPattern.test(text)) {
    return {
      forbidden: true,
      reason: "I cannot store passwords, PINs, or credentials for your security and privacy.",
    };
  }

  // 2. Credit / Debit card numbers
  const cardCandidates = text.match(/\b(?:\d[ -]*?){13,19}\b/g);
  if (cardCandidates) {
    for (const candidate of cardCandidates) {
      const cleanDigits = candidate.replace(/[\s-]/g, "");
      if (cleanDigits.length >= 13 && cleanDigits.length <= 19) {
        // If it starts with common card prefixes (4 for Visa, 51-55 for MC, 34/37 for Amex, etc.) or passes Luhn
        if (/^(?:4\d{12}(?:\d{3})?|5[1-5]\d{14}|3[47]\d{13}|6(?:011|5\d{2})\d{12})$/.test(cleanDigits) || passesLuhn(cleanDigits)) {
          return {
            forbidden: true,
            reason: "I cannot store payment card or credit card numbers for your security.",
          };
        }
      }
    }
  }

  // 3. Government IDs (Thai 13-digit ID, US SSN, Passport patterns)
  // Thai National ID: 13 digits
  const thaiIdMatch = text.match(/\b\d{1}-\d{4}-\d{5}-\d{2}-\d{1}\b/) || (/\b(id card|national id|citizen id|บัตรประชาชน|เลขบัตร)\b/i.test(text) && /\b\d{13}\b/.test(text));
  if (thaiIdMatch) {
    return {
      forbidden: true,
      reason: "I cannot store government or national ID numbers for your security.",
    };
  }

  // US SSN: 3-2-4 digits
  const ssnMatch = /\b(ssn|social security)\b[^\n\d]*\d{3}-\d{2}-\d{4}\b/i.test(text) || /\b\d{3}-\d{2}-\d{4}\b/.test(text);
  if (ssnMatch && /\b(ssn|social security|id)\b/i.test(text)) {
    return {
      forbidden: true,
      reason: "I cannot store government ID or Social Security numbers for your security.",
    };
  }

  // Passport number
  const passportMatch = /\b(passport number|passport no|passport #)\b\s*[:=is\s]*[a-z0-9]{6,12}\b/i;
  if (passportMatch.test(text)) {
    return {
      forbidden: true,
      reason: "I cannot store passport numbers for your security.",
    };
  }

  return { forbidden: false };
}

/** Topic signatures to detect semantic contradictions (e.g. new address replacing old address). */
const TOPIC_PATTERNS = [
  { name: "address", pattern: /\b(lives in|lives at|living in|home address|address is|moved to|resides in)\b/i },
  { name: "phone", pattern: /\b(phone number|mobile is|call me at|tel)\b/i },
  { name: "email", pattern: /\b(personal email|work email|email address|reach me at.*@)\b/i },
  { name: "wakeup", pattern: /\b(wakes up at|wake up at|morning routine at)\b/i },
  { name: "sleep", pattern: /\b(goes to bed at|bedtime is|sleeps at)\b/i },
  { name: "seat_preference", pattern: /\b(prefers (window|aisle) seat|seats? preference)\b/i },
  { name: "morning_meetings", pattern: /\b(no meetings before|meetings after)\b/i },
];

export function extractTopic(fact: string): string | null {
  for (const { name, pattern } of TOPIC_PATTERNS) {
    if (pattern.test(fact)) return name;
  }
  return null;
}

/** Check if two facts are about the same contradictory topic. */
export function areContradictory(existingFact: string, newFact: string): boolean {
  const t1 = extractTopic(existingFact);
  const t2 = extractTopic(newFact);
  if (t1 && t2 && t1 === t2) {
    return true;
  }
  return false;
}
