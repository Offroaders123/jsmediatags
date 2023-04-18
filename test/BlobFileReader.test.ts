import { jest, describe, beforeEach, it, expect } from "@jest/globals";

import BlobFileReader from "../src/BlobFileReader.js";

jest
  .dontMock("../src/BlobFileReader.js")
  .dontMock("../src/MediaFileReader.js")
  .dontMock("../src/ChunkedFileData.js");

describe("BlobFileReader", () => {
  let fileReader: BlobFileReader;

  beforeEach(() => {
    fileReader = new BlobFileReader(new Blob(["This is a simple file"]));
  });

  it("should be able to read the right type of files", () => {
    expect(BlobFileReader.canReadFile("fakefile")).toBe(false);
    expect(BlobFileReader.canReadFile("http://localhost")).toBe(false);
    expect(BlobFileReader.canReadFile(new Blob())).toBe(true);
  });

  it("should have the right size information", async () => {
    jest.runAllTimers();
    await fileReader.init();
    expect(fileReader.getSize()).toBe(21);
  });

  it("should read a byte", async () => {
    jest.runAllTimers();
    await fileReader.loadRange([0, 4]);
    expect(fileReader.getByteAt(0)).toBe("T".charCodeAt(0));
  });

  it("should read a byte after loading the same range twice", async () => {
    await fileReader.loadRange([0, 4]);
    await fileReader.loadRange([0, 4]);
    expect(fileReader.getByteAt(0)).toBe("T".charCodeAt(0));
  });

  it("should not read a byte that hasn't been loaded yet", async () => {
    jest.runAllTimers();
    await fileReader.init();
    expect(() => {
      fileReader.getByteAt(0);
    }).toThrow();
  });
});