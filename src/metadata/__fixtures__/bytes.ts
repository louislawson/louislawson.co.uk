import { crc32 } from "node:zlib";

// Tiny helpers for building file fixtures in memory. No test file carrying metadata is committed.

export function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export const ascii = (text: string): Uint8Array =>
  new Uint8Array(Buffer.from(text, "latin1"));

export const utf8 = (text: string): Uint8Array =>
  new Uint8Array(Buffer.from(text, "utf8"));

export function u16(value: number, littleEndian = false): Uint8Array {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, littleEndian);
  return bytes;
}

export function u32(value: number, littleEndian = false): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, littleEndian);
  return bytes;
}

export const crc = (bytes: Uint8Array): Uint8Array => u32(crc32(bytes));
