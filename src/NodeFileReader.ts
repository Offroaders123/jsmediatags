import * as fs from "node:fs";

import ChunkedFileData from "./ChunkedFileData.js";
import MediaFileReader from "./MediaFileReader.js";

import type { LoadCallbackType } from "./FlowTypes.js";

export default class NodeFileReader extends MediaFileReader {
  declare _path: string;
  declare _fileData: ChunkedFileData;

  constructor(path: string) {
    super();
    this._path = path;
    this._fileData = new ChunkedFileData();
  }

  static canReadFile(file: any): boolean {
    return (
      typeof file === "string"
      && !/^[a-z]+:\/\//i.test(file)
    );
  }

  getByteAt(offset: number): number {
    return this._fileData.getByteAt(offset);
  }

  _init(callbacks: LoadCallbackType) {
    fs.stat(this._path, (err, stats) => {
      if (err) {
        callbacks.onError?.({
          type: "fs",
          info: err as any
        });
      } else {
        this._size = stats.size;
        callbacks.onSuccess();
      }
    });
  }

  loadRange(range: [number, number], { onSuccess, onError }: LoadCallbackType) {
    let fd = -1;
    const fileData = this._fileData;

    const length = range[1] - range[0] + 1;

    if (fileData.hasDataRange(range[0], range[1])) {
      process.nextTick(onSuccess);
      return;
    }

    function readData(err: NodeJS.ErrnoException | null, _fd: number) {
      if (err) {
        onError?.({
          type: "fs",
          info: err as any
        });
        return;
      }

      fd = _fd;
      // TODO: Should create a pool of Buffer objects across all instances of
      //       NodeFileReader. This is fine for now.
      const buffer = new Buffer(length);
      fs.read(_fd, buffer, 0, length, range[0], processData);
    };

    function processData(err: NodeJS.ErrnoException | null, bytesRead: number, buffer: Buffer) {
      fs.close(fd, err => {
        if (err) {
          console.error(err);
        }
      });

      if (err) {
        onError?.({
          type: "fs",
          info: err as any
        });
        return;
      }

      storeBuffer(buffer);
      onSuccess();
    };

    function storeBuffer(buffer: Buffer) {
      const data = Array.prototype.slice.call(buffer, 0, length);
      fileData.addData(range[0], data);
    }

    fs.open(this._path, "r", undefined, readData);
  }
}