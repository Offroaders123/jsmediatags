import { jest } from "@jest/globals";

import * as fs from "node:fs";
import NodeFileReader from "../src/NodeFileReader.js";

jest
  .mock<typeof import("node:fs")>("node:fs")
  .dontMock("../src/NodeFileReader.js")
  .dontMock("../src/MediaFileReader.js")
  .dontMock("../src/ChunkedFileData.js");

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