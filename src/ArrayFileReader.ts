import MediaFileReader from './MediaFileReader.js';

import type { Byte, ByteArray, LoadCallbackType } from './FlowTypes.js';

export default class ArrayFileReader extends MediaFileReader {
  declare _array: ByteArray;
  declare _size: number;
  declare _isInitialized: boolean;

  constructor(array: ByteArray) {
    super();
    this._array = array;
    this._size = array.length;
    this._isInitialized = true;
  }

  static canReadFile(file: any): boolean {
    return (
      Array.isArray(file) ||
      (typeof Buffer === 'function' && Buffer.isBuffer(file))
    );
  }

  init(callbacks: LoadCallbackType) {
    setTimeout(callbacks.onSuccess, 0);
  }

  loadRange(range: [number, number], callbacks: LoadCallbackType) {
    setTimeout(callbacks.onSuccess, 0);
  }

  getByteAt(offset: number): Byte {
    if (offset >= this._array.length) {
      throw new Error("Offset " + offset + " hasn't been loaded yet.");
    }
    return this._array[offset];
  }
}