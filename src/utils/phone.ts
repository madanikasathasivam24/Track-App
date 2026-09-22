const INDIA_COUNTRY_CODE = '+91';

// UI/forms work with a bare 10-digit number; the backend stores/returns E.164 (+91XXXXXXXXXX).
export function toE164(localNumber: string): string {
  return `${INDIA_COUNTRY_CODE}${localNumber}`;
}

export function fromE164(phoneNumber: string): string {
  return phoneNumber.startsWith(INDIA_COUNTRY_CODE)
    ? phoneNumber.slice(INDIA_COUNTRY_CODE.length)
    : phoneNumber;
}
