import ChunkedFileData from "./ChunkedFileData.js";
import MediaFileReader from "./MediaFileReader.js";

import type { LoadCallbackType } from "./FlowTypes.js";

export default class BlobFileReader extends MediaFileReader {
  declare _blob: Blob;
  declare _fileData: ChunkedFileData;
  declare _size: number;

  constructor(blob: Blob) {
    super();
    this._blob = blob;
    this._fileData = new ChunkedFileData();
  }

  static override canReadFile(file: any): boolean {
    return (
      (typeof Blob !== "undefined" && file instanceof Blob) ||
      // File extends Blob but it seems that File instanceof Blob doesn't
      // quite work as expected in Cordova/PhoneGap.
      (typeof File !== "undefined" && file instanceof File)
    );
  }

  override _init({ onSuccess }: LoadCallbackType): void {
    this._size = this._blob.size;
    setTimeout(onSuccess, 1);
  }

  override async loadRange(range: [number, number], { onSuccess, onError }: LoadCallbackType): Promise<void> {
    const blob = this._blob.slice(range[0], range[1] + 1);
    let buffer: ArrayBuffer;

    try {
      buffer = await blob.arrayBuffer();
    } catch (error: any){
      onError?.({
        type: "blob",
        info: error
      });
      return;
    }

    const intArray = new Uint8Array(buffer);
    this._fileData.addData(range[0],intArray);

    onSuccess();
  }

  override getByteAt(offset: number): number {
    return this._fileData.getByteAt(offset);
  }
}