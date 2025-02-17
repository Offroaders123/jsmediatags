/**
 * @flow
 */
'use strict';

import RNFS = require('react-native-fs');
import { Buffer } from 'buffer';

import ChunkedFileData = require('./ChunkedFileData');
import MediaFileReader = require('./MediaFileReader');

import type {
  LoadCallbackType
} from './FlowTypes';


class ReactNativeFileReader extends MediaFileReader {
  private _path: string;
  private _fileData: ChunkedFileData;

  constructor(path: string) {
    super();
    this._path = path;
    this._fileData = new ChunkedFileData();
  }

  static override canReadFile(file: any): boolean {
    return (
      typeof file === 'string' &&
      !/^[a-z]+:\/\//i.test(file)
    );
  }

  override getByteAt(offset: number): number {
    return this._fileData.getByteAt(offset);
  }

  protected override _init(callbacks: LoadCallbackType): void {
    var self = this;

    RNFS.stat(self._path)
      .then(statResult => {
        self._size = statResult.size;
        callbacks.onSuccess();
      })
      .catch(error => {
        callbacks.onError({"type": "fs", "info": error});
      })
  }

  override loadRange(range: [number, number], callbacks: LoadCallbackType): void {
    var fileData = this._fileData;

    var length = range[1] - range[0] + 1;
    var onSuccess = callbacks.onSuccess;
    var onError = callbacks.onError || function(){};

    RNFS.read(this._path, length, range[0], {encoding: 'base64'})
      .then(readData => {
        const buffer = new Buffer(readData, 'base64');
        const data = Array.prototype.slice.call(buffer, 0, length);
        fileData.addData(range[0], data);
        onSuccess();
      })
      .catch(err => {
        onError({"type": "fs", "info": err});
      });
  }
}

export = ReactNativeFileReader;
