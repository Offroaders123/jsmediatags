import type { ByteArray } from "./FlowTypes.js";

export type DecodedString = InternalDecodedString;

class InternalDecodedString {
  declare private _value: string;
  declare bytesReadCount: number;
  declare length: number;

  constructor(value: string, bytesReadCount: number) {
    this._value = value;
    this.bytesReadCount = bytesReadCount;
    this.length = value.length;
  }

  toString(): string {
    return this._value;
  }
}

export function readUTF16String(bytes: ByteArray, bigEndian: boolean, maxBytes?: number): DecodedString {
  let ix = 0;
  let offset1 = 1, offset2 = 0;

  maxBytes = Math.min(maxBytes||bytes.length, bytes.length);

  if (bytes[0] == 0xFE && bytes[1] == 0xFF) {
    bigEndian = true;
    ix = 2;
  } else if (bytes[0] == 0xFF && bytes[1] == 0xFE) {
    bigEndian = false;
    ix = 2;
  }
  if (bigEndian) {
    offset1 = 0;
    offset2 = 1;
  }

  const arr: string[] = [];
  for (let j = 0; ix < maxBytes; j++) {
      const byte1 = bytes[ix+offset1];
      const byte2 = bytes[ix+offset2];
      const word1 = (byte1<<8)+byte2;
      ix += 2;
      if (word1 == 0x0000) {
          break;
      } else if (byte1 < 0xD8 || byte1 >= 0xE0) {
          arr[j] = String.fromCharCode(word1);
      } else {
          const byte3 = bytes[ix+offset1];
          const byte4 = bytes[ix+offset2];
          const word2 = (byte3<<8)+byte4;
          ix += 2;
          arr[j] = String.fromCharCode(word1, word2);
      }
  }
  return new InternalDecodedString(arr.join(""), ix);
}

export function readUTF8String(bytes: ByteArray, maxBytes?: number): DecodedString {
  let ix = 0;
  maxBytes = Math.min(maxBytes||bytes.length, bytes.length);

  if (bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF) {
    ix = 3;
  }

  const arr: string[] = [];
  for (let j = 0; ix < maxBytes; j++) {
    const byte1 = bytes[ix++];
    if (byte1 == 0x00) {
      break;
    } else if (byte1 < 0x80) {
      arr[j] = String.fromCharCode(byte1);
    } else if (byte1 >= 0xC2 && byte1 < 0xE0) {
      const byte2 = bytes[ix++];
      arr[j] = String.fromCharCode(((byte1&0x1F)<<6) + (byte2&0x3F));
    } else if (byte1 >= 0xE0 && byte1 < 0xF0) {
      const byte2 = bytes[ix++];
      const byte3 = bytes[ix++];
      arr[j] = String.fromCharCode(((byte1&0xFF)<<12) + ((byte2&0x3F)<<6) + (byte3&0x3F));
    } else if (byte1 >= 0xF0 && byte1 < 0xF5) {
      const byte2 = bytes[ix++];
      const byte3 = bytes[ix++];
      const byte4 = bytes[ix++];
      const codepoint = ((byte1&0x07)<<18) + ((byte2&0x3F)<<12)+ ((byte3&0x3F)<<6) + (byte4&0x3F) - 0x10000;
      arr[j] = String.fromCharCode(
        (codepoint>>10) + 0xD800,
        (codepoint&0x3FF) + 0xDC00
      );
    }
  }
  return new InternalDecodedString(arr.join(""), ix);
}

export function readNullTerminatedString(bytes: ByteArray, maxBytes?: number): DecodedString {
  const arr: string[] = [];
  maxBytes = maxBytes || bytes.length;
  let i = 0;
  while (i < maxBytes) {
    const byte1 = bytes[i++];
    if ( byte1 == 0x00 ) {
      break;
    }
    arr[i-1] = String.fromCharCode(byte1);
  }
  return new InternalDecodedString(arr.join(""), i);
}