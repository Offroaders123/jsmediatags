import ChunkedFileData from "./ChunkedFileData.js";
import MediaFileReader from "./MediaFileReader.js";

import type { LoadCallbackType } from "./FlowTypes.js";

export default class ArrayBufferFileReader extends MediaFileReader {
  declare _buffer: ArrayBuffer;
  declare _fileData: ChunkedFileData;
  declare _size: number;

  constructor(buffer: ArrayBuffer) {
    super();
    this._buffer = buffer;
    this._fileData = new ChunkedFileData();
  }

  static override canReadFile(file: any): boolean {
    return file instanceof ArrayBuffer
  }

  override _init({ onSuccess }: LoadCallbackType): void {
    this._size = this._buffer.byteLength;
    setTimeout(onSuccess, 1);
  }

  override loadRange(range: [number, number], { onSuccess }: LoadCallbackType): void {
    const arrayBuf = this._buffer.slice(range[0], range[1] + 1);
    const viewData = new Uint8Array(arrayBuf);
    this._fileData.addData(range[0], viewData);
    onSuccess();
  }

  override getByteAt(offset: number): number {
    return this._fileData.getByteAt(offset);
  }
}