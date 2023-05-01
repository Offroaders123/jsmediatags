import { jest, describe, beforeEach, it, expect } from "@jest/globals";

import type MediaFileReader from "../src/MediaFileReader.js";
import type MediaTagReader from "../src/MediaTagReader.js";
import type { TagType } from "../src/FlowTypes.js";

jest
  .enableAutomock()
  .dontMock("../src/index.js")
  .dontMock("../src/ByteArrayUtils.js")
  .useRealTimers();

const { read, Reader, Config } = jest.createMockFromModule<typeof import("../src/index.js")>("../src/index.js");
const { default: ArrayFileReader } = jest.createMockFromModule<typeof import("../src/ArrayFileReader.js")>("../src/ArrayFileReader.js");
const { default: ID3v1TagReader } = jest.createMockFromModule<typeof import("../src/ID3v1TagReader.js")>("../src/ID3v1TagReader.js");
const { default: ID3v2TagReader } = jest.createMockFromModule<typeof import("../src/ID3v2TagReader.js")>("../src/ID3v2TagReader.js");
const { default: MP4TagReader } = jest.createMockFromModule<typeof import("../src/MP4TagReader.js")>("../src/MP4TagReader.js");
const { default: FLACTagReader } = jest.createMockFromModule<typeof import("../src/FLACTagReader.js")>("../src/FLACTagReader.js");

describe("jsmediatags", () => {
  // const mockFileReader;
  const mockTags = {} as TagType;

  beforeEach(() => {
    Config.removeTagReader(ID3v1TagReader);
    Config.removeTagReader(MP4TagReader);
    Config.removeTagReader(FLACTagReader);
    // Reset auto mock to its original state.
    ID3v2TagReader.getTagIdentifierByteRange.mockReturnValue(
      {offset: 0, length: 0}
    );
    ID3v2TagReader.prototype.setTagsToRead = jest.fn<typeof ID3v2TagReader.prototype.setTagsToRead>().mockReturnThis();
  });

  it("should read tags with the shortcut function", async () => {
    NodeFileReader.canReadFile.mockReturnValue(true);
    ID3v2TagReader.canReadTagFormat.mockReturnValue(true);
    ID3v2TagReader.prototype.read = jest.fn<typeof ID3v2TagReader.prototype.read>()
      .mockImplementation(async () => mockTags);

    const tags = await read("fakefile");

    expect(tags).toBe(mockTags);
  });

  describe("file readers", () => {
    it("should use the given file reader", () => {
      const reader = new Reader();
      const MockFileReader = jest.fn() as unknown as typeof MediaFileReader;

      reader.setFileReader(MockFileReader);
      const fileReader = reader._getFileReader();

      expect(fileReader).toBe(MockFileReader);
    });

    it("should use the Array file reader for Buffers", () => {
      ArrayFileReader.canReadFile.mockReturnValue(true);

      const reader = new Reader();
      const FileReader = reader._getFileReader();

      expect(FileReader).toBe(ArrayFileReader);
    });
  });

  describe("tag readers", () => {
    it("should use the given tag reader", async () => {
      const MockTagReader = jest.fn() as unknown as typeof MediaTagReader;

      const reader = new Reader();
      reader.setTagReader(MockTagReader);
      const TagReader = await reader._getTagReader(null);

      expect(TagReader).toBe(MockTagReader);
    });

    it("should use the tag reader that is able to read the tags", async () => {
      const MockTagReader = jest.fn() as unknown as typeof MediaTagReader;
      Config.addTagReader(MockTagReader);

      ID3v2TagReader.canReadTagFormat.mockReturnValue(false);
      MockTagReader.getTagIdentifierByteRange = jest.fn<typeof MockTagReader.getTagIdentifierByteRange>()
        .mockReturnValue([]);
      MockTagReader.canReadTagFormat = jest.fn<typeof MockTagReader.canReadTagFormat>()
        .mockReturnValue(true);

      const reader = new Reader();
      const TagReader = await reader._getTagReader(new NodeFileReader());

      Config.removeTagReader(MockTagReader);
      expect(TagReader).toBe(MockTagReader);
    });

    it("should fail if no tag reader is found", () => {
      ID3v2TagReader.canReadTagFormat.mockReturnValue(false);
      const reader = new Reader();
      expect(reader._getTagReader(new NodeFileReader())).resolves.toThrow();
    });

    it("should load the super set range of all tag reader ranges", async () => {
      const MockTagReader = jest.fn() as unknown as typeof MediaTagReader;
      Config.addTagReader(MockTagReader);

      ID3v2TagReader.canReadTagFormat.mockReturnValue(false);
      ID3v2TagReader.getTagIdentifierByteRange.mockReturnValue(
        {offset: 2, length: 3}
      );
      MockTagReader.getTagIdentifierByteRange = jest.fn<typeof MockTagReader.getTagIdentifierByteRange>()
        .mockReturnValue({offset: 5, length: 2});
      MockTagReader.canReadTagFormat = jest.fn<typeof MockTagReader.canReadTagFormat>()
        .mockReturnValue(true);

      const reader = new Reader();
      await reader._findTagReader(new NodeFileReader());

      Config.removeTagReader(MockTagReader);
      const rangeSuperset = NodeFileReader.prototype.loadRange.mock.calls[0][0];
      expect(rangeSuperset).toEqual([2, 6]);
    });

    it("should not load the entire file if two tag loaders require start and end ranges for tag identifier", async () => {
      const fileReader = new NodeFileReader();
      const MockTagReader = jest.fn() as unknown as typeof MediaTagReader;
      Config.addTagReader(MockTagReader);

      fileReader.getSize.mockReturnValue(1024);

      ID3v2TagReader.canReadTagFormat.mockReturnValue(false);
      ID3v2TagReader.getTagIdentifierByteRange.mockReturnValue(
        {offset: 0, length: 3}
      );
      MockTagReader.getTagIdentifierByteRange = jest.fn<typeof MockTagReader.getTagIdentifierByteRange>()
        .mockReturnValue({offset: -3, length: 3});
      MockTagReader.canReadTagFormat = jest.fn<typeof MockTagReader.canReadTagFormat>()
        .mockReturnValue(true);

      const reader = new Reader();
      await reader._findTagReader(fileReader);

      Config.removeTagReader(MockTagReader);
      const loadRangeCalls = NodeFileReader.prototype.loadRange.mock.calls;
      expect(loadRangeCalls[0][0]).toEqual([0, 2]);
      expect(loadRangeCalls[1][0]).toEqual([1021, 1023]);
    });
  });
});