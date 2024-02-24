/**
 * @flow
 */
'use strict';

import MediaFileReader = require('./MediaFileReader');

import type {
  Byte,
  ByteArray,
  LoadCallbackType
} from './FlowTypes';

class ArrayFileReader extends MediaFileReader {
  private _array: ByteArray;

  constructor(array: ByteArray) {
    super();
    this._array = array;
    this._size = array.length;
    this._isInitialized = true;
  }

  static override canReadFile(file: any): boolean {
    return (
      Array.isArray(file) ||
      (typeof Buffer === 'function' && Buffer.isBuffer(file))
    );
  }

  protected override _init(callbacks: LoadCallbackType): void {
    setTimeout(callbacks.onSuccess, 0);
  }

  override loadRange(_range: [number, number], callbacks: LoadCallbackType): void {
    setTimeout(callbacks.onSuccess, 0);
  }

  override getByteAt(offset: number): Byte {
    if (offset >= this._array.length) {
      throw new Error("Offset " + offset + " hasn't been loaded yet.");
    }
    return this._array[offset]!;
  }
}

export = ArrayFileReader;
