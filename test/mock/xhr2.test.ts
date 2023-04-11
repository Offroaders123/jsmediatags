const xhr2Mock = jest.genMockFromModule("xhr2") as any;

export default xhr2Mock;

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
  open(): void;
  overrideMimeType(): void;
  setRequestHeader(): void;
  getResponseHeader(): string | void;
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
  this.open = jest.fn().mockImplementation((method, url) => {
    _url = url;
    _range = null;
  });
  this.overrideMimeType = jest.fn();
  this.setRequestHeader = jest.fn().mockImplementation(
    (headerName, headerValue) => {
      if (headerName.toLowerCase() === "range") {
        const matches = headerValue.match(/bytes=(\d+)-(\d+)/);
        _range = [Number(matches[1]), Number(matches[2])];
      }
    }
  );
  this.getResponseHeader = jest.fn().mockImplementation(
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

// @ts-ignore
const XMLHttpRequest = new XMLHttpRequestMock();
xhr2Mock.__setMockUrls = __setMockUrls;
xhr2Mock.XMLHttpRequest = XMLHttpRequest;
// @ts-expect-error
globalThis.XMLHttpRequest = () => XMLHttpRequest;