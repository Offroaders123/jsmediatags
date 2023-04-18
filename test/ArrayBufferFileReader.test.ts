import { jest, describe, beforeEach, it, expect } from "@jest/globals";

import ArrayBufferFileReader from "../src/ArrayBufferFileReader.js";

jest
  .dontMock("../src/ArrayBufferFileReader.js")
  .dontMock("../src/MediaFileReader.js")
  .dontMock("../src/ChunkedFileData.js");

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
    jest.runAllTimers();
    await fileReader.init();
    expect(fileReader.getSize()).toBe(8);
  });

  it("should read a byte", async () => {
    jest.runAllTimers();
    await fileReader.loadRange([0, 4]);
    expect(fileReader.getByteAt(0)).toBe("T".charCodeAt(0));
  });
});