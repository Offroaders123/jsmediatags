import { jest, describe, beforeEach, it, expect } from "@jest/globals";

import XhrFileReader from "../src/XhrFileReader.js";

jest
  .unstable_mockModule("xhr2",() => ({
    __setMockUrls: jest.fn(__setMockUrls),
    default: jest.fn(XMLHttpRequest)
  }))
  .dontMock("../src/XhrFileReader.js")
  .dontMock("../src/MediaFileReader.js")
  .dontMock("../src/ChunkedFileData.js");

// @ts-expect-error
const { default: xhr2 } = await import("xhr2");

interface MockURLs {
  [url: string]: MockURL;
}

type MockURL = string | MockURLData;

interface MockURLData {
  contents: string;
  disableRange: boolean;
  unknownLength: boolean;
  disallowedHeaders: string[];
  statusCode: number;
  timeout: number;
}

let _mockUrls: MockURLs = {};

// @ts-ignore
const XMLHttpRequest = new XMLHttpRequestMock();
// @ts-expect-error
globalThis.XMLHttpRequest = () => XMLHttpRequest;

function throwOnError(onSuccess: (error?: any) => void) {
  return {
    onSuccess,
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
    onError
  }
}

describe("XhrFileReader", () => {
  let fileReader: XhrFileReader;

  beforeEach(() => {
    jest.resetModules();
    xhr2.__setMockUrls({
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

  function describeFileSizeTests(avoidHeadRequests: boolean){
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
      fileReader.loadRange([0, 4], throwOnError(() => {
        fileReader.loadRange([0, 4], throwOnError(resolve));
      }));
      jest.runAllTimers();
    });
    expect(xhr2.XMLHttpRequest.send.mock.calls.length).toBe(1);
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
      jest.runAllTimers();
    });
    expect(fileReader.getByteAt(0)).toBe("T".charCodeAt(0));
  });

  it("should not read a byte that hasn't been loaded yet", async () => {
    await new Promise<void>(resolve => {
      fileReader.init(throwOnError(resolve));
      jest.runAllTimers();
    });
    expect(() => {
      fileReader.getByteAt(2000);
    }).toThrow();
  });

  it("should not read a file that does not exist", async () => {
    fileReader = new XhrFileReader("http://www.example.fakedomain/fail.mp3");

    await new Promise<void>(resolve => {
      fileReader.init(throwOnSuccess(error => {
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
    expect(xhr2.XMLHttpRequest.setRequestHeader.mock.calls[0][1]).toBe("bytes=0-1023");
  });

  it("should not fetch more than max file size", async () => {
    await new Promise<void>(resolve => {
      fileReader._size = 10;
      fileReader.loadRange([0, 4], throwOnError(resolve));
      jest.runAllTimers();
    });
    expect(xhr2.XMLHttpRequest.setRequestHeader.mock.calls[0][1]).toBe("bytes=0-10");
  });

  it("should not use disallowed headers", async () => {
    await new Promise<void>(resolve => {
      XhrFileReader.setConfig({
        disallowedXhrHeaders: ["If-Modified-Since"]
      });
      fileReader.loadRange([0, 4], throwOnError(resolve));
      jest.runAllTimers();
    });
    const calls = xhr2.XMLHttpRequest.setRequestHeader.mock.calls;
    for (let i = 0; i < calls.length; i++) {
      expect(calls[i][0].toLowerCase()).not.toBe("if-modified-since");
    }
  });

  it("should not rely on content-length when range is not supported", async () => {
    await new Promise<void>(resolve => {
      XhrFileReader.setConfig({
        avoidHeadRequests: true
      });
      xhr2.XMLHttpRequest.getAllResponseHeaders = jest.fn().mockReturnValue("");
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

function __setMockUrls(newMockUrls: MockURLs) {
  _mockUrls = {};

  for (const url in newMockUrls) {
    _mockUrls[url] = newMockUrls[url];
  }
};

function isRangeDisabled(url: string) {
  return !!((_mockUrls[url] || {}) as MockURLData).disableRange;
}

function getUrlContents(url: string, range?: [number,number] | null): string | null {
  const urlData = _mockUrls[url];

  if (urlData == null) {
    return null;
  }

  if ((urlData as MockURLData).disableRange) {
    range = null;
  }

  let contents: string;
  if (typeof urlData === "string") {
    contents = urlData;
  } else {
    contents = urlData.contents;
  }

  return range ? contents.slice(range[0], range[1] + 1) : contents;
}

function getUrlFileLength(url: string) {
  const urlData = _mockUrls[url];

  if (urlData == null || (urlData as MockURLData).unknownLength) {
    return null;
  }

  return getUrlContents(url)!.length;
}

function isHeaderDisallowed(url: string, header?: string) {
  const urlData = _mockUrls[url];
  return (
    urlData != null &&
    ((urlData as MockURLData).disallowedHeaders || []).indexOf(header!) >= 0
  );
}

function getUrlContentLength(url: string, range: [number,number] | null) {
  if (isHeaderDisallowed(url, "content-length")) {
    return null;
  }

  return getUrlContents(url, range)!.length;
}

function getUrlStatusCode(url: string) {
  const urlData = _mockUrls[url];

  if (urlData == null) {
    return 404;
  } else {
    return (urlData as MockURLData).statusCode || 200;
  }
}

function getTimeout(url: string) {
  const urlData = _mockUrls[url];
  return urlData ? (urlData as MockURLData).timeout : 0;
}

interface XMLHttpRequestMock {
  onload(): void;
  open(method: string, url: string): void;
  overrideMimeType(): void;
  setRequestHeader(headerName: string, headerValue: string): void;
  getResponseHeader(headerName: string): string | number | void | null;
  _getContentRange(): string | void;
  getAllResponseHeaders(): void;
  send(): void;
  status: number | null;
  responseText: string | null;
  timeout?: number;
  ontimeout?: (error: Error) => void;
}

function XMLHttpRequestMock(this: XMLHttpRequestMock) {
  let _url: string;
  let _range: [number,number] | null;

  this.onload = () => {};
  this.open = jest.fn<typeof this.open>().mockImplementation((method, url) => {
    _url = url;
    _range = null;
  });
  this.overrideMimeType = jest.fn<typeof this.overrideMimeType>();
  this.setRequestHeader = jest.fn<typeof this.setRequestHeader>().mockImplementation(
    (headerName, headerValue) => {
      if (headerName.toLowerCase() === "range") {
        const matches = headerValue.match(/bytes=(\d+)-(\d+)/)!;
        _range = [Number(matches[1]), Number(matches[2])];
      }
    }
  );
  this.getResponseHeader = jest.fn<typeof this.getResponseHeader>().mockImplementation(
    headerName => {
      if (headerName.toLowerCase() === "content-length") {
        return getUrlContentLength(_url, _range);
      } else if (headerName.toLowerCase() === "content-range") {
        return this._getContentRange();
      }
    }
  );
  this._getContentRange = () => {
    if (_range && !isRangeDisabled(_url) && !isHeaderDisallowed("content-range")) {
      const endByte = Math.min(_range[1], getUrlContents(_url)!.length - 1);
      return "bytes " + _range[0] + "-" + endByte + "/" + (getUrlFileLength(_url) || "*");
    }
  }
  this.getAllResponseHeaders = jest.fn().mockImplementation(
    () => {
      const headers = [];

      headers.push("content-length: " + getUrlContentLength(_url, _range));
      if (this._getContentRange()) {
        headers.push("content-range: " + this._getContentRange());
      }

      return headers.join("\r\n");
    }
  );
  this.send = jest.fn().mockImplementation(() => {
    const requestTimeout = getTimeout(_url);

    setTimeout(
      () => {
        this.status = getUrlStatusCode(_url);
        this.responseText = getUrlContents(_url, _range);
        this.onload();
      },
      requestTimeout
    );

    if (requestTimeout && this.timeout && requestTimeout > this.timeout && this.ontimeout) {
      setTimeout(
        () => {
          this.ontimeout?.({} as Error);
        },
        this.timeout
      );
    }
  });
}