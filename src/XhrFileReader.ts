import ChunkedFileData from "./ChunkedFileData.js";
import MediaFileReader from "./MediaFileReader.js";

import type { LoadCallbackType, CallbackType } from "./FlowTypes.js";

const CHUNK_SIZE = 1024;

type ContentRangeType = {
  firstBytePosition?: number | null,
  lastBytePosition?: number | null,
  instanceLength?: number | null,
};

export default class XhrFileReader extends MediaFileReader {
  static _config = {
    avoidHeadRequests: false,
    disallowedXhrHeaders: [] as string[],
    timeoutInSec: 30
  };

  declare _url: string;
  declare _fileData: ChunkedFileData;

  constructor(url: string) {
    super();
    this._url = url;
    this._fileData = new ChunkedFileData();
  }

  static canReadFile(file: any): boolean {
    return (
      typeof file === "string" &&
      /^[a-z]+:\/\//i.test(file)
    );
  }

  static setConfig(config: Partial<typeof this._config>) {
    for (const key in config) if (config.hasOwnProperty(key)) {
      // @ts-expect-error
      this._config[key] = config[key];
    }

    const disallowedXhrHeaders = this._config.disallowedXhrHeaders;
    for (let i = 0; i < disallowedXhrHeaders.length; i++) {
      disallowedXhrHeaders[i] = disallowedXhrHeaders[i].toLowerCase();
    }
  }

  _init(callbacks: LoadCallbackType): void {
    if (XhrFileReader._config.avoidHeadRequests) {
      this._fetchSizeWithGetRequest(callbacks);
    } else {
      this._fetchSizeWithHeadRequest(callbacks);
    }
  }

  _fetchSizeWithHeadRequest(callbacks: LoadCallbackType): void {
    this._makeXHRRequest("HEAD", null, {
      onSuccess: (xhr: XMLHttpRequest) => {
        const contentLength = this._parseContentLength(xhr);
        if (contentLength) {
          this._size = contentLength;
          callbacks.onSuccess();
        } else {
          // Content-Length not provided by the server, fallback to
          // GET requests.
          this._fetchSizeWithGetRequest(callbacks);
        }
      },
      onError: callbacks.onError
    });
  }

  _fetchSizeWithGetRequest(callbacks: LoadCallbackType): void {
    const range = this._roundRangeToChunkMultiple([0, 0]);

    this._makeXHRRequest("GET", range, {
      onSuccess: (xhr: XMLHttpRequest) => {
        const contentRange = this._parseContentRange(xhr);
        const data = this._getXhrResponseContent(xhr);

        if (contentRange) {
          if (contentRange.instanceLength == null) {
            // Last resort, server is not able to tell us the content length,
            // need to fetch entire file then.
            this._fetchEntireFile(callbacks);
            return;
          }
          this._size = contentRange.instanceLength;
        } else {
          // Range request not supported, we got the entire file
          this._size = data.length;
        }

        this._fileData.addData(0, data);
        callbacks.onSuccess();
      },
      onError: callbacks.onError
    });
  }

  _fetchEntireFile(callbacks: LoadCallbackType): void {
    this._makeXHRRequest("GET", null, {
      onSuccess: (xhr: XMLHttpRequest) => {
        const data = this._getXhrResponseContent(xhr);
        this._size = data.length;
        this._fileData.addData(0, data);
        callbacks.onSuccess();
      },
      onError: callbacks.onError
    });
  }

  _getXhrResponseContent(xhr: XMLHttpRequest): string {
    // @ts-expect-error
    return xhr.responseBody || xhr.response || xhr.responseText || "";
  }

  _parseContentLength(xhr: XMLHttpRequest): number | null {
    const contentLength = this._getResponseHeader(xhr, "Content-Length");

    if (contentLength == null) {
      return contentLength;
    } else {
      return parseInt(contentLength, 10);
    }
  }

  _parseContentRange(xhr: XMLHttpRequest): ContentRangeType | null {
    const contentRange = this._getResponseHeader(xhr, "Content-Range");

    if (contentRange) {
      const parsedContentRange = contentRange.match(
        /bytes (\d+)-(\d+)\/(?:(\d+)|\*)/i
      );
      if (!parsedContentRange) {
        throw new Error("FIXME: Unknown Content-Range syntax: " + contentRange);
      }

      return {
        firstBytePosition: parseInt(parsedContentRange[1], 10),
        lastBytePosition: parseInt(parsedContentRange[2], 10),
        instanceLength: parsedContentRange[3] ? parseInt(parsedContentRange[3], 10) : null
      };
    } else {
      return null;
    }
  }

  loadRange(range: [number, number], callbacks: LoadCallbackType): void {
    if (this._fileData.hasDataRange(range[0], Math.min(this._size, range[1]))) {
      setTimeout(callbacks.onSuccess, 1);
      return;
    }

    // Always download in multiples of CHUNK_SIZE. If we're going to make a
    // request might as well get a chunk that makes sense. The big cost is
    // establishing the connection so getting 10bytes or 1K doesn't really
    // make a difference.
    range = this._roundRangeToChunkMultiple(range);

    // Upper range should not be greater than max file size
    range[1] = Math.min(this._size, range[1]);

    this._makeXHRRequest("GET", range, {
      onSuccess: (xhr: XMLHttpRequest) => {
        const data = this._getXhrResponseContent(xhr);
        this._fileData.addData(range[0], data);
        callbacks.onSuccess();
      },
      onError: callbacks.onError
    });
  }

  _roundRangeToChunkMultiple(range: [number, number]): [number, number] {
    const length = range[1] - range[0] + 1;
    const newLength = Math.ceil(length/CHUNK_SIZE) * CHUNK_SIZE;
    return [range[0], range[0] + newLength - 1];
  }

  _makeXHRRequest(
    method: string,
    range: [number, number] | null,
    callbacks: CallbackType
  ) {
    const xhr = this._createXHRObject();
    xhr.open(method, this._url);

    const onXHRLoad = function() {
      // 200 - OK
      // 206 - Partial Content
      // $FlowIssue - xhr will not be null here
      if (xhr.status === 200 || xhr.status === 206) {
        callbacks.onSuccess(xhr);
      } else if (callbacks.onError) {
        callbacks.onError({
          type: "xhr",
          info: `Unexpected HTTP status ${xhr.status}.`,
          xhr
        });
      }
      // @ts-ignore
      xhr = null;
    };

    if (typeof xhr.onload !== "undefined") {
      xhr.onload = onXHRLoad;
      xhr.onerror = function() {
        if (callbacks.onError) {
          callbacks.onError({
            type: "xhr",
            info: "Generic XHR error, check xhr object.",
            xhr,
          });
        }
      }
    } else {
      xhr.onreadystatechange = function() {
        // $FlowIssue - xhr will not be null here
        if (xhr.readyState === 4) {
          onXHRLoad();
        }
      };
    }

    if (XhrFileReader._config.timeoutInSec) {
      xhr.timeout = XhrFileReader._config.timeoutInSec * 1000;
      xhr.ontimeout = function() {
        if (callbacks.onError) {
          callbacks.onError({
            type: "xhr",
            // $FlowIssue - xhr.timeout will not be null
            info: `Timeout after ${xhr.timeout/1000}s. Use jsmediatags.Config.setXhrTimeout to override.`,
            xhr,
          });
        }
      }
    }

    xhr.overrideMimeType("text/plain; charset=x-user-defined");
    if (range) {
      this._setRequestHeader(xhr, "Range", `bytes=${range[0]}-${range[1]}`);
    }
    this._setRequestHeader(xhr, "If-Modified-Since", "Sat, 01 Jan 1970 00:00:00 GMT");
    xhr.send(null);
  }

  _setRequestHeader(xhr: XMLHttpRequest, headerName: string, headerValue: string) {
    if (XhrFileReader._config.disallowedXhrHeaders.indexOf(headerName.toLowerCase()) < 0) {
      xhr.setRequestHeader(headerName, headerValue);
    }
  }

  _hasResponseHeader(xhr: XMLHttpRequest, headerName: string): boolean {
    const allResponseHeaders = xhr.getAllResponseHeaders();

    if (!allResponseHeaders) {
      return false;
    }

    const headers = allResponseHeaders.split("\r\n");
    const headerNames = [];
    for (let i = 0; i < headers.length; i++) {
      headerNames[i] = headers[i].split(":")[0].toLowerCase();
    }

    return headerNames.indexOf(headerName.toLowerCase()) >= 0;
  }

  _getResponseHeader(xhr: XMLHttpRequest, headerName: string): string | null {
    if (!this._hasResponseHeader(xhr, headerName)) {
      return null;
    }

    return xhr.getResponseHeader(headerName);
  }

  getByteAt(offset: number): number {
    const character = this._fileData.getByteAt(offset);
    return character.charCodeAt(0) & 0xff;
  }

  _isWebWorker(): boolean {
    return (
      // @ts-expect-error
      typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope
    );
  }

  _createXHRObject(): XMLHttpRequest {
    if (typeof window === "undefined" && !this._isWebWorker()) {
      // $FlowIssue - flow is not able to recognize this module.
      return new (require("xhr2").XMLHttpRequest)();
    }

    if (typeof XMLHttpRequest !== "undefined") {
      return new XMLHttpRequest();
    }

    throw new Error("XMLHttpRequest is not supported");
  }
}