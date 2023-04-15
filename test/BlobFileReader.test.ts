import { jest } from "@jest/globals";

import BlobFileReader from "../src/BlobFileReader.js";

jest
  .dontMock("../src/BlobFileReader.js")
  .dontMock("../src/MediaFileReader.js")
  .dontMock("../src/ChunkedFileData.js");

function throwOnError(onSuccess: () => void) {
  return {
    onSuccess: onSuccess,
    onError: () => {
      throw new Error();
    }
  }
}

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
    await new Promise<void>(resolve => {
      fileReader.init(throwOnError(resolve));
      jest.runAllTimers();
    });
    expect(fileReader.getSize()).toBe(21);
  });

  it("should read a byte", async () => {
    await new Promise<void>(resolve => {
      fileReader.loadRange([0, 4], throwOnError(resolve));
      jest.runAllTimers();
    });
    expect(fileReader.getByteAt(0)).toBe("T".charCodeAt(0));
  });

  it("should read a byte after loading the same range twice", async () => {
    await new Promise<void>(resolve => {
      fileReader.loadRange([0, 4], throwOnError(() => {
        fileReader.loadRange([0, 4], throwOnError(resolve));
      }));
    });
    expect(fileReader.getByteAt(0)).toBe("T".charCodeAt(0));
  });

  it("should not read a byte that hasn't been loaded yet", async () => {
    await new Promise<void>(resolve => {
      fileReader.init(throwOnError(resolve));
      jest.runAllTimers();
    });
    expect(() => {
      var byte0 = fileReader.getByteAt(0);
    }).toThrow();
  });
});
