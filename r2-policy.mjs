// Server-side policy for the upcoming R2 adapter. Not a billing cap.
// Call only inside a serialized reservation transaction using a fresh inventory.
export const R2_UPLOAD_LIMIT_BYTES = 9_000_000_000;
export const R2_MAX_FILE_BYTES = 50 * 1024 * 1024;
const validBytes = n => Number.isSafeInteger(n) && n >= 0;
export function r2UploadDecision({configured, inventoryComplete, inventoryAt, now,
  storedBytes, reservedBytes, incomingBytes}) {
  if (configured !== true) return {allowed:false, reason:'not_configured'};
  if (inventoryComplete !== true || !Number.isSafeInteger(now) ||
      !Number.isSafeInteger(inventoryAt) || inventoryAt > now || now-inventoryAt > 300_000)
    return {allowed:false, reason:'inventory_unavailable'};
  if (![storedBytes,reservedBytes,incomingBytes].every(validBytes) ||
      incomingBytes < 1 || incomingBytes > R2_MAX_FILE_BYTES)
    return {allowed:false, reason:'invalid_size'};
  // Subtraction avoids overflowing when untrusted counters are large.
  const remaining = Math.max(0, R2_UPLOAD_LIMIT_BYTES - storedBytes - reservedBytes);
  return incomingBytes <= remaining
    ? {allowed:true, remainingBytes:remaining-incomingBytes}
    : {allowed:false, reason:'storage_limit', remainingBytes:remaining};
}
