import { jest, describe, beforeEach, it, expect } from "@jest/globals";

import ArrayFileReader from "../src/ArrayFileReader.js";

jest
  .dontMock("../src/ArrayFileReader.js")
  .dontMock("../src/MediaFileReader.js")
  .useRealTimers();

describe("ArrayFileReader", () => {
  let fileReader: ArrayFileReader;

  beforeEach(() => {
    fileReader = new ArrayFileReader([...Buffer.from("This is a simple file")]);
  });

  it("should be able to read the right type of files", () => {
    expect(ArrayFileReader.canReadFile(Buffer.from("Test"))).toBe(true);
    expect(ArrayFileReader.canReadFile([10, 24])).toBe(true);
    expect(ArrayFileReader.canReadFile("fakefile")).toBe(false);
    expect(ArrayFileReader.canReadFile("http://localhost")).toBe(false);
    expect(ArrayFileReader.canReadFile(new Blob())).toBe(false);
  });

  it("should have the right size information", async () => {
    await fileReader.init();
    expect(fileReader.getSize()).toBe(21);
  });

  it("should read a byte", async () => {
    await fileReader.loadRange([0, 4]);
    expect(fileReader.getByteAt(0)).toBe("T".charCodeAt(0));
  });
});