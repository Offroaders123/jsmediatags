/**
 * @flow
 */
'use strict';

import ChunkedFileData = require('./ChunkedFileData');
import MediaFileReader = require('./MediaFileReader');

import type {
  LoadCallbackType
} from './FlowTypes';

class BlobFileReader extends MediaFileReader {
  private _blob: Blob;
  private _fileData: ChunkedFileData;

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

  protected override _init(callbacks: LoadCallbackType): void {
    this._size = this._blob.size;
    setTimeout(callbacks.onSuccess, 1);
  }

  override loadRange(range: [number, number], callbacks: LoadCallbackType): void {
    var self = this;
    // $FlowIssue - flow isn't aware of mozSlice or webkitSlice
    var blobSlice = this._blob.slice || this._blob.mozSlice || this._blob.webkitSlice;
    var blob = blobSlice.call(this._blob, range[0], range[1] + 1);
    var browserFileReader = new FileReader();

    browserFileReader.onloadend = function() {
      var intArray = new Uint8Array(browserFileReader.result as ArrayBuffer);
      self._fileData.addData(range[0], intArray);
      callbacks.onSuccess();
    };
    browserFileReader.onerror =
    browserFileReader.onabort = function() {
      if (callbacks.onError) {
        callbacks.onError({"type": "blob", "info": browserFileReader.error});
      }
    };

    browserFileReader.readAsArrayBuffer(blob);
  }

  override getByteAt(offset: number): number {
    return this._fileData.getByteAt(offset);
  }
}

declare global {
  interface Blob {
    mozSlice: typeof Blob.prototype.slice;
    webkitSlice: typeof Blob.prototype.slice;
  }
}

export = BlobFileReader;
