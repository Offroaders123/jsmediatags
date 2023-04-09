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

  static canReadFile(file: any): boolean {
    return (
      (typeof Blob !== "undefined" && file instanceof Blob) ||
      // File extends Blob but it seems that File instanceof Blob doesn't
      // quite work as expected in Cordova/PhoneGap.
      (typeof File !== "undefined" && file instanceof File)
    );
  }

  _init({ onSuccess }: LoadCallbackType): void {
    this._size = this._blob.size;
    setTimeout(onSuccess, 1);
  }

  loadRange(range: [number, number], { onSuccess, onError }: LoadCallbackType): void {
    const self = this;
    // @ts-expect-error - flow isn't aware of mozSlice or webkitSlice
    const blobSlice = this._blob.slice || this._blob.mozSlice || this._blob.webkitSlice;
    const blob = blobSlice.call(this._blob, range[0], range[1] + 1);
    const browserFileReader = new FileReader();

    browserFileReader.onloadend = () => {
      const intArray = new Uint8Array(browserFileReader.result! as ArrayBuffer);
      self._fileData.addData(range[0], intArray);
      onSuccess();
    };
    browserFileReader.onerror =
    browserFileReader.onabort = () => {
      if (onError) {
        onError({"type": "blob", "info": browserFileReader.error});
      }
    };

    browserFileReader.readAsArrayBuffer(blob);
  }

  getByteAt(offset: number): number {
    return this._fileData.getByteAt(offset);
  }
}