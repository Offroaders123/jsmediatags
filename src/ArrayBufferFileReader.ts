import ChunkedFileData from "./ChunkedFileData.js";
import MediaFileReader from "./MediaFileReader.js";

export default class ArrayBufferFileReader extends MediaFileReader {
  declare private _buffer: ArrayBuffer;
  declare private _fileData: ChunkedFileData;

  constructor(buffer: ArrayBuffer) {
    super();
    this._buffer = buffer;
    this._fileData = new ChunkedFileData();
  }

  static override canReadFile(file: any): boolean {
    return file instanceof ArrayBuffer
  }

  protected override async _init(): Promise<void> {
    this._size = this._buffer.byteLength;
    await new Promise(resolve => setTimeout(resolve, 1));
  }

  override async loadRange(range: [number, number]): Promise<void> {
    const arrayBuf = this._buffer.slice(range[0], range[1] + 1);
    const viewData = new Uint8Array(arrayBuf);
    this._fileData.addData(range[0], viewData);
  }

  override getByteAt(offset: number): number {
    return this._fileData.getByteAt(offset);
  }
}