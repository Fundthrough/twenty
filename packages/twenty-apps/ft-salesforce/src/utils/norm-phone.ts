// Same normalizer as seed-local.mjs — the server infers country from the +-prefixed
// number; passing countryCode/callingCode explicitly triggers CONFLICTING_PHONE_COUNTRY_CODE.
// Shared by marketo-intake (form phones) and process-dialpad-event (call matching).
export const normalizePhoneE164 = (raw?: string): string | undefined => {
  if (!raw) return undefined;
  let digits = raw.replace(/[^+\d]/g, '');
  if (!digits.startsWith('+')) {
    if (digits.length === 10) digits = '+1' + digits;
    else if (digits.length === 11 && digits.startsWith('1')) digits = '+' + digits;
    else return undefined; // unparseable — skip rather than fail the record
  }
  return digits;
};
