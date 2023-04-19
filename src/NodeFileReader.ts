import * as fs from "node:fs";

import ChunkedFileData from "./ChunkedFileData.js";
import MediaFileReader from "./MediaFileReader.js";

export default class NodeFileReader extends MediaFileReader {
  declare _path: string;
  declare _fileData: ChunkedFileData;

  constructor(path: string) {
    super();
    this._path = path;
    this._fileData = new ChunkedFileData();
  }

  static override canReadFile(file: any): boolean {
    return (
      typeof file === "string"
      && !/^[a-z]+:\/\//i.test(file)
    );
  }

  override getByteAt(offset: number): number {
    return this._fileData.getByteAt(offset);
  }

  override async _init() {
    return new Promise<void>((resolve, reject) => {
      fs.stat(this._path, (err, stats) => {
        if (err){
          reject(new Error(`fs: ${err.message}`));
        } else {
          this._size = stats.size;
          resolve();
        }
      });
    });
  }

  override async loadRange(range: [number, number]) {
    let fd = -1;
    const fileData = this._fileData;

    const length = range[1] - range[0] + 1;

    if (fileData.hasDataRange(range[0], range[1])) {
      return new Promise<void>(resolve => process.nextTick(resolve));
    }

    function readData(err: NodeJS.ErrnoException | null, _fd: number) {
      if (err) {
        throw new Error(`fs: ${err.message}`);
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
        throw new Error(`fs: ${err.message}`);
      }

      storeBuffer(buffer);
    };

    function storeBuffer(buffer: Buffer) {
      const data = Array.prototype.slice.call(buffer, 0, length);
      fileData.addData(range[0], data);
    }

    const [err, _fd] = await new Promise<[(NodeJS.ErrnoException | null), number]>(resolve => fs.open(this._path, "r", undefined, (err, fd) => {
      resolve([err, fd]);
    }));

    readData(err,_fd);
  }
}