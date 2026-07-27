/** Masks phone-number-like digit runs (7+ digits, optionally spaced/dashed) in free-text
 * P2P chat messages until the Seller explicitly shares contact details. */
const PHONE_LIKE_RE = /(\+?\d[\d\s-]{6,}\d)/g;

export function maskPhoneNumbers(text) {
  return String(text || '').replace(PHONE_LIKE_RE, (match) => {
    const digits = match.replace(/\D/g, '');
    if (digits.length < 7) return match;
    return '••• hidden until contact is shared •••';
  });
}
