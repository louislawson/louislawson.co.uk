// Small helpers for reading bytes, shared by the metadata checks.

export const latin1 = (bytes: Uint8Array): string =>
  Buffer.from(bytes).toString("latin1");

/** Whether `text` (as Latin-1 characters) is at `at` in `bytes`. */
export function startsWith(bytes: Uint8Array, text: string, at = 0): boolean {
  return latin1(bytes.subarray(at, at + text.length)) === text;
}

// The byte-order mark and the replacement character, built from their code points so no invisible
// character sits in this source file.
const BOM_AND_REPLACEMENT = new RegExp(
  `[${String.fromCharCode(0xfeff, 0xfffd)}]`,
  "g",
);

/**
 * Text from bytes that may be UTF-8 or UTF-16. Read as UTF-8, UTF-16 has a NUL between every
 * character and would hide every name from a pattern match; dropping the NULs and the byte-order
 * mark undoes that for the ASCII text that metadata is made of.
 */
export function decodeText(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("utf8")
    .replaceAll("\0", "")
    .replaceAll(BOM_AND_REPLACEMENT, "");
}
