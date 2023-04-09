import * as jsmediatags from "../src/jsmediatags.js";
import NodeFileReader from "../src/NodeFileReader.js";
import XhrFileReader from "../src/XhrFileReader.js";
import ArrayFileReader from "../src/ArrayFileReader.js";
import ID3v1TagReader from "../src/ID3v1TagReader.js";
import ID3v2TagReader from "../src/ID3v2TagReader.js";
import MP4TagReader from "../src/MP4TagReader.js";
import FLACTagReader from "../src/FLACTagReader.js";

jest
  .enableAutomock()
  .dontMock("../src/jsmediatags.js")
  .dontMock("../src/ByteArrayUtils.js");

function throwOnSuccess(onError: () => void) {
  return {
    onSuccess: () => {
      throw new Error();
    },
    onError: onError
  }
}

describe("jsmediatags", () => {
  var mockFileReader;
  var mockTags = {};

  beforeEach(() => {
    jsmediatags.Config.removeTagReader(ID3v1TagReader);
    jsmediatags.Config.removeTagReader(MP4TagReader);
    jsmediatags.Config.removeTagReader(FLACTagReader);
    // Reset auto mock to its original state.
    NodeFileReader.canReadFile = jest.fn();
    NodeFileReader.prototype.init = jest.fn()
      .mockImplementation(callbacks => {
        setTimeout(() => {
          callbacks.onSuccess();
        }, 1);
      });
    NodeFileReader.prototype.loadRange = jest.fn()
      .mockImplementation((range, callbacks) => {
        setTimeout(() => {
          callbacks.onSuccess();
        }, 1);
      });

      // @ts-ignore
    ID3v2TagReader.getTagIdentifierByteRange.mockReturnValue(
      {offset: 0, length: 0}
    );
    ID3v2TagReader.prototype.setTagsToRead = jest.fn().mockReturnThis();
  });

  it("should read tags with the shortcut function", async () => {
    // @ts-ignore
    NodeFileReader.canReadFile.mockReturnValue(true);
    // @ts-ignore
    ID3v2TagReader.canReadTagFormat.mockReturnValue(true);
    ID3v2TagReader.prototype.read = jest.fn()
      .mockImplementation(callbacks => {
        callbacks.onSuccess(mockTags);
      });

    const tags = await new Promise((resolve, reject) => {
      jsmediatags.read("fakefile", { onSuccess: resolve, onError: reject });
      jest.runAllTimers();
    });
    expect(tags).toBe(mockTags);
  });

  describe("file readers", () => {
    it("should use the given file reader", () => {
      // @ts-ignore
      var reader = new jsmediatags.Reader();
      var MockFileReader = jest.fn();

      reader.setFileReader(MockFileReader);
      var fileReader = reader._getFileReader();

      expect(fileReader).toBe(MockFileReader);
    });

    it("should use the node file reader", () => {
      // @ts-ignore
      NodeFileReader.canReadFile.mockReturnValue(true);

      // @ts-ignore
      var reader = new jsmediatags.Reader();
      var FileReader = reader._getFileReader();

      expect(FileReader).toBe(NodeFileReader);
    });

    it("should use the Array file reader for Buffers", () => {
      // @ts-ignore
      ArrayFileReader.canReadFile.mockReturnValue(true);

      // @ts-ignore
      var reader = new jsmediatags.Reader();
      var FileReader = reader._getFileReader();

      expect(FileReader).toBe(ArrayFileReader);
    });

    it("should use the XHR file reader", () => {
      // @ts-ignore
      XhrFileReader.canReadFile.mockReturnValue(true);

      // @ts-ignore
      var reader = new jsmediatags.Reader();
      var FileReader = reader._getFileReader();

      expect(FileReader).toBe(XhrFileReader);
    });
  });

  describe("tag readers", () => {
    it("should use the given tag reader", async () => {
      var MockTagReader = jest.fn();

      const TagReader = await new Promise((resolve, reject) => {
        // @ts-ignore
        var reader = new jsmediatags.Reader();
        reader.setTagReader(MockTagReader);
        reader._getTagReader(null, { onSuccess: resolve, onError: reject });
        jest.runAllTimers();
      });
      expect(TagReader).toBe(MockTagReader);
    });

    it("should use the tag reader that is able to read the tags", async () => {
      var MockTagReader = jest.fn();
      jsmediatags.Config.addTagReader(MockTagReader);

      // @ts-ignore
      ID3v2TagReader.canReadTagFormat.mockReturnValue(false);
      MockTagReader.getTagIdentifierByteRange = jest.fn()
      // @ts-ignore
        .mockReturnValue([]);
      MockTagReader.canReadTagFormat = jest.fn()
      // @ts-ignore
        .mockReturnValue(true);

      const TagReader = await new Promise((resolve, reject) => {
        // @ts-ignore
        var reader = new jsmediatags.Reader();
        reader._getTagReader(new NodeFileReader(), { onSuccess: resolve, onError: reject });
        jest.runAllTimers();
      });
      jsmediatags.Config.removeTagReader(MockTagReader);
      expect(TagReader).toBe(MockTagReader);
    });

    it("should fail if no tag reader is found", () => {
      // @ts-ignore
      ID3v2TagReader.canReadTagFormat.mockReturnValue(false);
      return new Promise(resolve => {
        // @ts-ignore
        var reader = new jsmediatags.Reader();
        reader._getTagReader(new NodeFileReader(), throwOnSuccess(resolve));
        jest.runAllTimers();
      });
    });

    it("should load the super set range of all tag reader ranges", async () => {
      var MockTagReader = jest.fn();
      jsmediatags.Config.addTagReader(MockTagReader);

      // @ts-ignore
      ID3v2TagReader.canReadTagFormat.mockReturnValue(false);
      // @ts-ignore
      ID3v2TagReader.getTagIdentifierByteRange.mockReturnValue(
        {offset: 2, length: 3}
      );
      MockTagReader.getTagIdentifierByteRange = jest.fn()
      // @ts-ignore
        .mockReturnValue({offset: 5, length: 2});
      MockTagReader.canReadTagFormat = jest.fn()
      // @ts-ignore
        .mockReturnValue(true);

      await new Promise((resolve, reject) => {
        // @ts-ignore
        var reader = new jsmediatags.Reader();
        reader._findTagReader(new NodeFileReader(), { onSuccess: resolve, onError: reject });
        jest.runAllTimers();
      });
      jsmediatags.Config.removeTagReader(MockTagReader);
      var rangeSuperset = NodeFileReader.prototype.loadRange.mock.calls[0][0];
      expect(rangeSuperset).toEqual([2, 6]);
    });

    it("should not load the entire file if two tag loaders require start and end ranges for tag identifier", async () => {
      var fileReader = new NodeFileReader();
      var MockTagReader = jest.fn();
      jsmediatags.Config.addTagReader(MockTagReader);

      // @ts-ignore
      fileReader.getSize.mockReturnValue(1024);

      // @ts-ignore
      ID3v2TagReader.canReadTagFormat.mockReturnValue(false);
      // @ts-ignore
      ID3v2TagReader.getTagIdentifierByteRange.mockReturnValue(
        {offset: 0, length: 3}
      );
      MockTagReader.getTagIdentifierByteRange = jest.fn()
      // @ts-ignore
        .mockReturnValue({offset: -3, length: 3});
      MockTagReader.canReadTagFormat = jest.fn()
      // @ts-ignore
        .mockReturnValue(true);

      await new Promise((resolve, reject) => {
        // @ts-ignore
        var reader = new jsmediatags.Reader();
        reader._findTagReader(fileReader, { onSuccess: resolve, onError: reject });
        jest.runAllTimers();
      });
      jsmediatags.Config.removeTagReader(MockTagReader);
      var loadRangeCalls = NodeFileReader.prototype.loadRange.mock.calls;
      expect(loadRangeCalls[0][0]).toEqual([0, 2]);
      expect(loadRangeCalls[1][0]).toEqual([1021, 1023]);
    });
  });
});
