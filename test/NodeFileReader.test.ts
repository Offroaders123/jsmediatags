import { jest } from "@jest/globals";

import NodeFileReader from "../src/NodeFileReader.js";

/**
 * Extended from https://facebook.github.io/jest/docs/manual-mocks.html
 */
// Get the real (not mocked) version of the 'path' module
import * as path from "node:path";

// Get the automatic mock for `fs`
jest
  .unstable_mockModule("node:fs",() => ({
    // Override the default behavior of the `readdirSync` mock
    readdirSync: jest.fn(readdirSync),
    open: jest.fn(open),
    read: jest.fn(read),
    stat: jest.fn(stat),
    // Add a custom method to the mock
    __setMockFiles: jest.fn(__setMockFiles)
  }))
  .dontMock("../src/NodeFileReader.js")
  .dontMock("../src/MediaFileReader.js")
  .dontMock("../src/ChunkedFileData.js");

const fs = await import("node:fs");

interface MockFiles {
  [file: string]: string | MockFiles;
}

// This is a custom function that our tests can use during setup to specify
// what the files on the "mock" filesystem should look like when any of the
// `fs` APIs are used.
let _mockFiles: MockFiles = {};

describe("NodeFileReader", () => {
  let fileReader: NodeFileReader;

  beforeEach(() => {
    // @ts-ignore
    fs.__setMockFiles({
      fakefile: "This is a simple file"
    });
  });

  it("should be able to read the right type of files", () => {
    expect(NodeFileReader.canReadFile("fakefile")).toBe(true);
    expect(NodeFileReader.canReadFile("http://localhost")).toBe(false);
    expect(NodeFileReader.canReadFile(new Blob())).toBe(false);
  });

  it("should have the right size information", async () => {
    fileReader = new NodeFileReader("fakefile");

    await new Promise<void>((onSuccess, onError) => {
      fileReader.init({ onSuccess, onError });
    });
    expect(fileReader.getSize()).toBe(21);
  });

  it("should read a byte", async () => {
    fileReader = new NodeFileReader("fakefile");

    await new Promise<void>((onSuccess, onError) => {
      fileReader.loadRange([0, 4], { onSuccess, onError });
    });
    expect(fileReader.getByteAt(0)).toBe("T".charCodeAt(0));
  });

  it("should read a byte after loading the same range twice", async () => {
    fileReader = new NodeFileReader("fakefile");

    await new Promise<void>((onSuccess, onError) => {
      fileReader.loadRange([0, 4], {
        onSuccess() {
          fileReader.loadRange([0, 4], { onSuccess, onError });
        },
        onError
      });
    });
    expect(fileReader.getByteAt(0)).toBe("T".charCodeAt(0));
  });

  it("should not read a byte that hasn't been loaded yet", async () => {
    fileReader = new NodeFileReader("fakefile");

    await new Promise<void>((onSuccess, onError) => {
      fileReader.init({ onSuccess, onError });
    });
    expect(() => {
      fileReader.getByteAt(0);
    }).toThrow();
  });

  it("should not read a file that does not exist", async () => {
    fileReader = new NodeFileReader("doesnt-exist");

    await new Promise<void>((onSuccess, onError) => {
      fileReader.init({
        onSuccess,
        onError(error_1: any) {
          expect(error_1.type).toBe("fs");
          expect(error_1.info).toBeDefined();
          onSuccess();
        }
      });
    });
    expect(true).toBe(true);
  });
});

function __setMockFiles(newMockFiles: MockFiles) {
  _mockFiles = {};

  for (const file in newMockFiles) {
    const dir = path.dirname(file);

    if (!_mockFiles[dir]) {
      _mockFiles[dir] = {};
    }

    // @ts-expect-error
    _mockFiles[dir][path.basename(file)] = newMockFiles[file];
  }
};

// A custom version of `readdirSync` that reads from the special mocked out
// file list set via __setMockFiles
function readdirSync(directoryPath: string) {
  return _mockFiles[directoryPath] || [];
};

const _fds: { path: string; }[] = [];
function open(path: string, flags: unknown, mode: unknown, callback: (error: Error | null, fd: number) => void) {
  const fd = _fds.push({
    path: path
  }) - 1;

  process.nextTick(() => {
    if (callback) {
      callback(null, fd);
    }
  });
}

function read(fd: number, buffer: Buffer, offset: number, length: number, position: number, callback: (error: Error | null, length?: number, buffer?: Buffer) => void) {
  const file = _fds[fd];
  const dir = path.dirname(file.path);
  const name = path.basename(file.path);

  // @ts-expect-error
  if (_mockFiles[dir] && _mockFiles[dir][name]) {
    // @ts-expect-error
    const data = _mockFiles[dir][name].substr(position, length);
    buffer.write(data, offset, length);
    process.nextTick(() => {
      callback(null, length, buffer);
    });
  } else {
    process.nextTick(() => {
      callback(new Error("File not found"));
    });
  }
}

function stat(_path: string, callback: (error: Error | null, stat?: { size: number }) => void) {
  const dir = path.dirname(_path);
  const name = path.basename(_path);

  // @ts-expect-error
  if (_mockFiles[dir] && _mockFiles[dir][name]) {
    process.nextTick(() => {
      callback(null, {
        // @ts-expect-error
        size: _mockFiles[dir][name].length
      });
    });
  } else {
    process.nextTick(() => {
      callback({} as Error);
    })
  }
}