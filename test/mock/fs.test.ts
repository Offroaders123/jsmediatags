/**
 * Extended from https://facebook.github.io/jest/docs/manual-mocks.html
 */
// Get the real (not mocked) version of the 'path' module
import * as path from "node:path";

// Get the automatic mock for `fs`
const fsMock = jest.genMockFromModule("fs") as typeof import("node:fs");

export default fsMock;

interface MockFiles {
  [file: string]: string | MockFiles;
}

// This is a custom function that our tests can use during setup to specify
// what the files on the "mock" filesystem should look like when any of the
// `fs` APIs are used.
let _mockFiles: MockFiles = {};
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

  process.nextTick(function() {
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
    process.nextTick(function() {
      callback(null, length, buffer);
    });
  } else {
    process.nextTick(function() {
      callback(new Error("File not found"));
    });
  }
}

function stat(_path: string, callback: (error: Error | null, stat?: { size: number }) => void) {
  const dir = path.dirname(_path);
  const name = path.basename(_path);

  // @ts-expect-error
  if (_mockFiles[dir] && _mockFiles[dir][name]) {
    process.nextTick(function() {
      callback(null, {
        // @ts-expect-error
        size: _mockFiles[dir][name].length
      });
    });
  } else {
    process.nextTick(function() {
      callback({} as Error);
    })
  }
}

// Override the default behavior of the `readdirSync` mock
// @ts-ignore
fsMock.readdirSync.mockImplementation(readdirSync);
// @ts-ignore
fsMock.open.mockImplementation(open);
// @ts-ignore
fsMock.read.mockImplementation(read);
// @ts-ignore
fsMock.stat.mockImplementation(stat);

// Add a custom method to the mock
// @ts-ignore
fsMock.__setMockFiles = __setMockFiles;
