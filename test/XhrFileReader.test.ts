import XhrFileReader from "../src/XhrFileReader.js";

jest
  .mock("xhr2")
  .dontMock("../src/XhrFileReader.js")
  .dontMock("../src/MediaFileReader.js")
  .dontMock("../src/ChunkedFileData.js");

function throwOnError(onSuccess: (error?: any) => void) {
  return {
    onSuccess: onSuccess,
    onError: () => {
      throw new Error();
    }
  }
}

function throwOnSuccess(onError: (error?: any) => void) {
  return {
    onSuccess: () => {
      throw new Error();
    },
    onError: onError
  }
}

describe("XhrFileReader", () => {
  var fileReader: XhrFileReader;

  beforeEach(() => {
    jest.resetModules();
    require("xhr2").__setMockUrls({
      "http://www.example.fakedomain/music.mp3": "This is a simple file",
      "http://www.example.fakedomain/big-file.mp3": new Array(100).join("This is a simple file"),
      "http://www.example.fakedomain/range-not-supported.mp3": {
        contents: new Array(100).join("This is a simple file"),
        disableRange: true
      },
      "http://www.example.fakedomain/range-supported.mp3": {
        contents: new Array(100).join("This is a simple file"),
      },
      "http://www.example.fakedomain/unknown-length.mp3": {
        contents: new Array(100).join("This is a simple file"),
        unknownLength: true
      },
      "http://www.example.fakedomain/timeout": {
        contents: "This is a simple file",
        timeout: 500
      },
    });
    XhrFileReader.setConfig({
      avoidHeadRequests: false,
      disallowedXhrHeaders: [],
      timeoutInSec: 30,
    });
    fileReader = new XhrFileReader("http://www.example.fakedomain/music.mp3");
  });

  it("should be able to read the right type of files", () => {
    expect(XhrFileReader.canReadFile("fakefile")).toBe(false);
    expect(XhrFileReader.canReadFile("http://localhost")).toBe(true);
    expect(XhrFileReader.canReadFile(new Blob())).toBe(false);
  });

  var describeFileSizeTests = function(avoidHeadRequests: boolean) {
    describe("file size with" + avoidHeadRequests ? "GET" : "HEAD", () => {
      beforeEach(() => {
        XhrFileReader.setConfig({
          avoidHeadRequests: avoidHeadRequests
        });
      });

      it("should have the right size information", async () => {
        await new Promise<void>(resolve => {
          fileReader.init(throwOnError(resolve));
          jest.runAllTimers();
        });
        expect(fileReader.getSize()).toBe(21);
      });

      it("should have the right size information for files bigger than the first range request", async () => {
        fileReader = new XhrFileReader("http://www.example.fakedomain/big-file.mp3");
        await new Promise<void>(resolve => {
          fileReader.init(throwOnError(resolve));
          jest.runAllTimers();
        });
        expect(fileReader.getSize()).toBe(2079);
      });

      it("should have the right size information when range not supported", async () => {
        fileReader = new XhrFileReader("http://www.example.fakedomain/range-not-supported.mp3");
        await new Promise<void>(resolve => {
          fileReader.init(throwOnError(resolve));
          jest.runAllTimers();
        });
        expect(fileReader.getSize()).toBe(2079);
      });

      it("should have the right size information when content length is unknown", async () => {
        fileReader = new XhrFileReader("http://www.example.fakedomain/unknown-length.mp3");
        await new Promise<void>(resolve => {
          fileReader.init(throwOnError(resolve));
          jest.runAllTimers();
        });
        expect(fileReader.getSize()).toBe(2079);
      });

      it("should have the right size information when range is supported", async () => {
        fileReader = new XhrFileReader("http://www.example.fakedomain/range-supported.mp3");
        await new Promise<void>(resolve => {
          fileReader.init(throwOnError(resolve));
          jest.runAllTimers();
        });
        expect(fileReader.getSize()).toBe(2079);
      });
    });
  }

  describeFileSizeTests(true /*GET*/);
  describeFileSizeTests(false /*HEAD*/);

  it("should not fetch the same data twice", async () => {
    await new Promise<void>(resolve => {
      fileReader.loadRange([0, 4], throwOnError(function () {
        fileReader.loadRange([0, 4], throwOnError(resolve));
      }));
      jest.runAllTimers();
    });
    expect(require("xhr2").XMLHttpRequest.send.mock.calls.length).toBe(1);
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
      fileReader.loadRange([0, 4], throwOnError(function () {
        fileReader.loadRange([0, 4], throwOnError(resolve));
      }));
      jest.runAllTimers();
    });
    expect(fileReader.getByteAt(0)).toBe("T".charCodeAt(0));
  });

  it("should not read a byte that hasn't been loaded yet", async () => {
    await new Promise<void>(resolve => {
      fileReader.init(throwOnError(resolve));
      jest.runAllTimers();
    });
    expect(function () {
      var byte0 = fileReader.getByteAt(2000);
    }).toThrow();
  });

  it("should not read a file that does not exist", async () => {
    fileReader = new XhrFileReader("http://www.example.fakedomain/fail.mp3");

    await new Promise<void>(resolve => {
      fileReader.init(throwOnSuccess(function (error) {
        expect(error.type).toBe("xhr");
        expect(error.xhr).toBeDefined();
        resolve();
      }));
      jest.runAllTimers();
    });
    expect(true).toBe(true);
  });

  it("should fetch in multples of 1K", async () => {
    await new Promise<void>(resolve => {
      fileReader._size = 2000;
      fileReader.loadRange([0, 4], throwOnError(resolve));
      jest.runAllTimers();
    });
    expect(require("xhr2").XMLHttpRequest.setRequestHeader.mock.calls[0][1]).toBe("bytes=0-1023");
  });

  it("should not fetch more than max file size", async () => {
    await new Promise<void>(resolve => {
      fileReader._size = 10;
      fileReader.loadRange([0, 4], throwOnError(resolve));
      jest.runAllTimers();
    });
    expect(require("xhr2").XMLHttpRequest.setRequestHeader.mock.calls[0][1]).toBe("bytes=0-10");
  });

  it("should not use disallowed headers", async () => {
    await new Promise<void>(resolve => {
      XhrFileReader.setConfig({
        disallowedXhrHeaders: ["If-Modified-Since"]
      });
      fileReader.loadRange([0, 4], throwOnError(resolve));
      jest.runAllTimers();
    });
    var calls = require("xhr2").XMLHttpRequest.setRequestHeader.mock.calls;
    for (var i = 0; i < calls.length; i++) {
      expect(calls[i][0].toLowerCase()).not.toBe("if-modified-since");
    }
  });

  it("should not rely on content-length when range is not supported", async () => {
    await new Promise<void>(resolve => {
      XhrFileReader.setConfig({
        avoidHeadRequests: true
      });
      require("xhr2").XMLHttpRequest.getAllResponseHeaders = jest.fn().mockReturnValue("");
      fileReader.init(throwOnError(resolve));
      jest.runAllTimers();
    });
    expect(fileReader.getSize()).toBe(21);
  });

  it("should timeout if request takes too much time", async () => {
    fileReader = new XhrFileReader("http://www.example.fakedomain/timeout");
    XhrFileReader.setConfig({
      timeoutInSec: 0.2
    });
    await new Promise<void>(resolve => {
      fileReader.init(throwOnSuccess(function (error) {
        expect(error.type).toBe("xhr");
        expect(error.xhr).toBeDefined();
        resolve();
      }));
      jest.runAllTimers();
    });
    expect(true).toBe(true);
  });
});
