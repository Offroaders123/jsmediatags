import { jest, describe, beforeEach, it, expect } from "@jest/globals";

import ArrayBufferFileReader from "../src/ArrayBufferFileReader.js";

jest
  .dontMock("../src/ArrayBufferFileReader.js")
  .dontMock("../src/MediaFileReader.js")
  .dontMock("../src/ChunkedFileData.js");

function throwOnError(onSuccess: () => void) {
  return {
    onSuccess,
    onError: () => {
      throw new Error();
    }
  }
}

function str2ab(str: string) {
  const buf = new ArrayBuffer(str.length * 2); // 2 bytes for each char
  const bufView = new Uint16Array(buf);
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

describe("ArrayBufferFileReader", () => {
  let fileReader: ArrayBufferFileReader;
  const arrBuffer = str2ab("TEST");

  beforeEach(() => {
    fileReader = new ArrayBufferFileReader(arrBuffer);
  });

  it("should be able to read the right type of files", () => {
    expect(ArrayBufferFileReader.canReadFile(arrBuffer)).toBe(true);
  });

  it("should have the right size information", async () => {
    await new Promise<void>(resolve => {
      fileReader.init(throwOnError(resolve));
      jest.runAllTimers();
    });
    expect(fileReader.getSize()).toBe(8);
  });

  it("should read a byte", async () => {
    await new Promise<void>(resolve => {
      fileReader.loadRange([0, 4], throwOnError(resolve));
      jest.runAllTimers();
    });
    expect(fileReader.getByteAt(0)).toBe("T".charCodeAt(0));
  });
});