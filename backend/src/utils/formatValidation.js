/**
 * Validation utilities for business registration identifiers.
 */

export const isValidCIN = (cin) => {
  if (!cin || typeof cin !== 'string') return false;
  const clean = cin.trim().toUpperCase();
  // 21 character Indian MCA CIN pattern (e.g. U72200MH2020PTC123456)
  const cinRegex = /^[UL]\d{5}[A-Z]{2}\d{4}(PTC|PLC|FTC|SGC|GAP|FLC|ULT|GOI|NPL)\d{6}$/;
  // Indian LLPIN pattern (7 chars e.g. AAA-1234 or AAB-1234)
  const llpinRegex = /^[A-Z]{3}-?\d{4}$/;
  return cinRegex.test(clean) || llpinRegex.test(clean);
};

export const isValidGSTIN = (gstin) => {
  if (!gstin || typeof gstin !== 'string') return false;
  const clean = gstin.trim().toUpperCase();
  // 15 character Indian GSTIN pattern (e.g. 27AAPCU12341ZV)
  const gstinRegex = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinRegex.test(clean);
};

export const isValidUdyam = (udyam) => {
  if (!udyam || typeof udyam !== 'string') return false;
  const clean = udyam.trim().toUpperCase();
  // Indian MSME Udyam pattern (e.g. UDYAM-MH-01-0012345)
  const udyamRegex = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/;
  return udyamRegex.test(clean);
};
