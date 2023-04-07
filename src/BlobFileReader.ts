import ChunkedFileData from './ChunkedFileData';
import MediaFileReader from './MediaFileReader';

import type { LoadCallbackType } from './FlowTypes';

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

  _init(callbacks: LoadCallbackType): void {
    this._size = this._blob.size;
    setTimeout(callbacks.onSuccess, 1);
  }

  loadRange(range: [number, number], callbacks: LoadCallbackType): void {
    var self = this;
    // $FlowIssue - flow isn't aware of mozSlice or webkitSlice
    // @ts-expect-error
    var blobSlice = this._blob.slice || this._blob.mozSlice || this._blob.webkitSlice;
    var blob = blobSlice.call(this._blob, range[0], range[1] + 1);
    var browserFileReader = new FileReader();

    browserFileReader.onloadend = function(event) {
      var intArray = new Uint8Array(browserFileReader.result! as ArrayBuffer);
      self._fileData.addData(range[0], intArray);
      callbacks.onSuccess();
    };
    browserFileReader.onerror =
    browserFileReader.onabort = function(event) {
      if (callbacks.onError) {
        callbacks.onError({"type": "blob", "info": browserFileReader.error});
      }
    };

    browserFileReader.readAsArrayBuffer(blob);
  }

  getByteAt(offset: number): number {
    return this._fileData.getByteAt(offset);
  }
}