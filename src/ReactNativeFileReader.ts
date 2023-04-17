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

  static override canReadFile(file: any): boolean {
    return (
      typeof file === "string" &&
      !/^[a-z]+:\/\//i.test(file)
    );
  }

  override getByteAt(offset: number): number {
    return this._fileData.getByteAt(offset);
  }

  override async _init({ onSuccess, onError }: LoadCallbackType) {
    try {
      const statResult = await RNFS.stat(this._path);
      this._size = statResult.size;
      onSuccess();
    } catch (error){
      onError?.({
        type: "fs",
        info: error as any
      });
    }
  }

  override async loadRange(range: [number, number], { onSuccess, onError }: LoadCallbackType) {
    const fileData = this._fileData;
    const length = range[1] - range[0] + 1;

    try {
      const readData = await RNFS.read(this._path, length, range[0], { encoding: "base64" });

      const buffer = Buffer.from(readData, "base64");
      const data = Array.prototype.slice.call(buffer, 0, length);
      fileData.addData(range[0], data);

      onSuccess();
    } catch (err){
      onError?.({
        type: "fs",
        info: err as any
      });
    }
  }
}