import * as RNFS from "react-native-fs";
import { Buffer } from "buffer";

import ChunkedFileData from "./ChunkedFileData.js";
import MediaFileReader from "./MediaFileReader.js";

import type { LoadCallbackType } from "./FlowTypes.js";

export default class ReactNativeFileReader extends MediaFileReader {
  declare _path: string;
  declare _fileData: ChunkedFileData;

  constructor(path: string) {
    super();
    this._path = path;
    this._fileData = new ChunkedFileData();
  }

  static canReadFile(file: any): boolean {
    return (
      typeof file === "string" &&
      !/^[a-z]+:\/\//i.test(file)
    );
  }

  getByteAt(offset: number): number {
    return this._fileData.getByteAt(offset);
  }

  _init(callbacks: LoadCallbackType) {
    RNFS.stat(this._path)
      .then(statResult => {
        this._size = statResult.size;
        callbacks.onSuccess();
      })
      .catch(error => {
        callbacks.onError?.({
          type: "fs",
          info: error
        });
      })
  }

  loadRange(range: [number, number], callbacks: LoadCallbackType) {
    const fileData = this._fileData;

    const length = range[1] - range[0] + 1;
    const onSuccess = callbacks.onSuccess;
    const onError = callbacks.onError || function(){};

    RNFS.read(this._path, length, range[0], {encoding: "base64"})
      .then(readData => {
        const buffer = Buffer.from(readData, "base64");
        const data = Array.prototype.slice.call(buffer, 0, length);
        fileData.addData(range[0], data);
        onSuccess();
      })
      .catch(err => {
        onError({
          type: "fs",
          info: err
        });
      });
  }
}