import MediaFileReader from "./MediaFileReader.js";

import type { ByteArray } from "./FlowTypes.js";

export default class ArrayFileReader extends MediaFileReader {
  declare _array: ByteArray;

  constructor(array: ByteArray) {
    super();
    this._array = array;
    this._size = array.length;
    this._isInitialized = true;
  }

  static override canReadFile(file: any): boolean {
    return (
      Array.isArray(file) ||
      (typeof Buffer === "function" && Buffer.isBuffer(file))
    );
  }

  override async init() {
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  override async loadRange(range: [number, number]) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  override getByteAt(offset: number) {
    if (offset >= this._array.length) {
      throw new Error(`Offset ${offset} hasn't been loaded yet.`);
    }
    return this._array[offset];
  }
}