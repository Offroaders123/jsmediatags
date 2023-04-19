import { jest, describe, beforeEach, it, expect } from "@jest/globals";

import type MediaFileReader from "../src/MediaFileReader.js";
import type MediaTagReader from "../src/MediaTagReader.js";
import type { TagType } from "../src/FlowTypes.js";

jest
  .enableAutomock()
  .dontMock("../src/index.js")
  .dontMock("../src/ByteArrayUtils.js")
  .useRealTimers();

const { read, Config } = await import("../src/index.js");
const { default: ArrayFileReader } = await import("../src/ArrayFileReader.js");
const { default: ID3v1TagReader } = await import("../src/ID3v1TagReader.js");
const { default: ID3v2TagReader } = await import("../src/ID3v2TagReader.js");
const { default: MP4TagReader } = await import("../src/MP4TagReader.js");
const { default: FLACTagReader } = await import("../src/FLACTagReader.js");

describe("jsmediatags", () => {
  // const mockFileReader;
  const mockTags = {} as TagType;

  beforeEach(() => {
    Config.removeTagReader(ID3v1TagReader);
    Config.removeTagReader(MP4TagReader);
    Config.removeTagReader(FLACTagReader);
    // Reset auto mock to its original state.
      // @ts-ignore
    ID3v2TagReader.getTagIdentifierByteRange.mockReturnValue(
      {offset: 0, length: 0}
    );
    ID3v2TagReader.prototype.setTagsToRead = jest.fn<typeof ID3v2TagReader.prototype.setTagsToRead>().mockReturnThis();
  });

  it("should read tags with the shortcut function", async () => {
    // @ts-ignore
    NodeFileReader.canReadFile.mockReturnValue(true);
    // @ts-ignore
    ID3v2TagReader.canReadTagFormat.mockReturnValue(true);
    ID3v2TagReader.prototype.read = jest.fn<typeof ID3v2TagReader.prototype.read>()
      .mockImplementation(async () => mockTags);

    const tags = await read("fakefile");

    expect(tags).toBe(mockTags);
  });

  describe("file readers", () => {
    it("should use the given file reader", () => {
      // @ts-ignore
      const reader = new Reader();
      const MockFileReader = jest.fn() as unknown as typeof MediaFileReader;

      reader.setFileReader(MockFileReader);
      const fileReader = reader._getFileReader();

      expect(fileReader).toBe(MockFileReader);
    });

    it("should use the Array file reader for Buffers", () => {
      // @ts-ignore
      ArrayFileReader.canReadFile.mockReturnValue(true);

      // @ts-ignore
      const reader = new Reader();
      const FileReader = reader._getFileReader();

      expect(FileReader).toBe(ArrayFileReader);
    });
  });

  describe("tag readers", () => {
    it("should use the given tag reader", async () => {
      const MockTagReader = jest.fn() as unknown as typeof MediaTagReader;

      const TagReader = await new Promise((onSuccess, onError) => {
        // @ts-ignore
        const reader = new Reader();
        reader.setTagReader(MockTagReader);
        // @ts-ignore
        reader._getTagReader(null, { onSuccess, onError });
      });
      expect(TagReader).toBe(MockTagReader);
    });

    it("should use the tag reader that is able to read the tags", async () => {
      const MockTagReader = jest.fn() as unknown as typeof MediaTagReader;
      Config.addTagReader(MockTagReader);

      // @ts-ignore
      ID3v2TagReader.canReadTagFormat.mockReturnValue(false);
      MockTagReader.getTagIdentifierByteRange = jest.fn<typeof MockTagReader.getTagIdentifierByteRange>()
      // @ts-ignore
        .mockReturnValue([]);
      MockTagReader.canReadTagFormat = jest.fn<typeof MockTagReader.canReadTagFormat>()
        .mockReturnValue(true);

      const TagReader = await new Promise((onSuccess, onError) => {
        // @ts-ignore
        const reader = new Reader();
        // @ts-ignore
        reader._getTagReader(new NodeFileReader(), { onSuccess, onError });
      });
      Config.removeTagReader(MockTagReader);
      expect(TagReader).toBe(MockTagReader);
    });

    it("should fail if no tag reader is found", () => {
      // @ts-ignore
      ID3v2TagReader.canReadTagFormat.mockReturnValue(false);
      return new Promise<void>(onSuccess => {
        // @ts-ignore
        const reader = new Reader();
        // @ts-ignore
        reader._getTagReader(new NodeFileReader(), throwOnSuccess(onSuccess));
      });
    });

    it("should load the super set range of all tag reader ranges", async () => {
      const MockTagReader = jest.fn() as unknown as typeof MediaTagReader;
      Config.addTagReader(MockTagReader);

      // @ts-ignore
      ID3v2TagReader.canReadTagFormat.mockReturnValue(false);
      // @ts-ignore
      ID3v2TagReader.getTagIdentifierByteRange.mockReturnValue(
        {offset: 2, length: 3}
      );
      MockTagReader.getTagIdentifierByteRange = jest.fn<typeof MockTagReader.getTagIdentifierByteRange>()
        .mockReturnValue({offset: 5, length: 2});
      MockTagReader.canReadTagFormat = jest.fn<typeof MockTagReader.canReadTagFormat>()
        .mockReturnValue(true);

      await new Promise((onSuccess, onError) => {
        // @ts-ignore
        const reader = new Reader();
        // @ts-ignore
        reader._findTagReader(new NodeFileReader(), { onSuccess, onError });
      });
      Config.removeTagReader(MockTagReader);
      // @ts-ignore
      const rangeSuperset = NodeFileReader.prototype.loadRange.mock.calls[0][0];
      expect(rangeSuperset).toEqual([2, 6]);
    });

    it("should not load the entire file if two tag loaders require start and end ranges for tag identifier", async () => {
      // @ts-ignore
      const fileReader = new NodeFileReader();
      const MockTagReader = jest.fn() as unknown as typeof MediaTagReader;
      Config.addTagReader(MockTagReader);

      // @ts-ignore
      fileReader.getSize.mockReturnValue(1024);

      // @ts-ignore
      ID3v2TagReader.canReadTagFormat.mockReturnValue(false);
      // @ts-ignore
      ID3v2TagReader.getTagIdentifierByteRange.mockReturnValue(
        {offset: 0, length: 3}
      );
      MockTagReader.getTagIdentifierByteRange = jest.fn<typeof MockTagReader.getTagIdentifierByteRange>()
        .mockReturnValue({offset: -3, length: 3});
      MockTagReader.canReadTagFormat = jest.fn<typeof MockTagReader.canReadTagFormat>()
        .mockReturnValue(true);

      await new Promise((onSuccess, onError) => {
        // @ts-ignore
        const reader = new Reader();
        reader._findTagReader(fileReader, { onSuccess, onError });
      });
      Config.removeTagReader(MockTagReader);
      // @ts-ignore
      const loadRangeCalls = NodeFileReader.prototype.loadRange.mock.calls;
      expect(loadRangeCalls[0][0]).toEqual([0, 2]);
      expect(loadRangeCalls[1][0]).toEqual([1021, 1023]);
    });
  });
});