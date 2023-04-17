import MediaFileReader from "./MediaFileReader.js";
import XhrFileReader from "./XhrFileReader.js";
import BlobFileReader from "./BlobFileReader.js";
import ArrayFileReader from "./ArrayFileReader.js";
import MediaTagReader from "./MediaTagReader.js";
import ID3v1TagReader from "./ID3v1TagReader.js";
import ID3v2TagReader from "./ID3v2TagReader.js";
import MP4TagReader from "./MP4TagReader.js";
import FLACTagReader from "./FLACTagReader.js";

import type { CallbackType, LoadCallbackType, ByteRange } from "./FlowTypes.js";

const mediaFileReaders: typeof MediaFileReader[] = [];
const mediaTagReaders: typeof MediaTagReader[] = [];

export function read(location: Object, callbacks: CallbackType) {
  new Reader(location).read(callbacks);
}

function isRangeValid(range: ByteRange, fileSize: number) {
  const invalidPositiveRange = range.offset >= 0
    && range.offset + range.length >= fileSize

  const invalidNegativeRange = range.offset < 0
    && (-range.offset > fileSize || range.offset + range.length > 0)

  return !(invalidPositiveRange || invalidNegativeRange)
}

export class Reader {
  declare _file: any;
  declare _tagsToRead: string[];
  declare _fileReader: typeof MediaFileReader;
  declare _tagReader: typeof MediaTagReader;

  constructor(file: any) {
    this._file = file;
  }

  setTagsToRead(tagsToRead: string[]): Reader {
    this._tagsToRead = tagsToRead;
    return this;
  }

  setFileReader(fileReader: typeof MediaFileReader): Reader {
    this._fileReader = fileReader;
    return this;
  }

  setTagReader(tagReader: typeof MediaTagReader): Reader {
    this._tagReader = tagReader;
    return this;
  }

  read(callbacks: CallbackType) {
    const FileReader = this._getFileReader();
    const fileReader = new FileReader(this._file);

    fileReader.init({
      onSuccess: () => {
        this._getTagReader(fileReader, {
          onSuccess: (TagReader: typeof MediaTagReader) => {
            new TagReader(fileReader)
              .setTagsToRead(this._tagsToRead)
              .read(callbacks);
          },
          onError: callbacks.onError
        });
      },
      onError: callbacks.onError
    });
  }

  _getFileReader(): typeof MediaFileReader {
    if (this._fileReader) {
      return this._fileReader;
    } else {
      return this._findFileReader();
    }
  }

  _findFileReader(): typeof MediaFileReader {
    for (let i = 0; i < mediaFileReaders.length; i++) {
      if (mediaFileReaders[i].canReadFile(this._file)) {
        return mediaFileReaders[i];
      }
    }

    throw new Error("No suitable file reader found for " + this._file);
  }

  _getTagReader(fileReader: MediaFileReader, callbacks: CallbackType) {
    if (this._tagReader) {
      const tagReader = this._tagReader;
      setTimeout(() => {
        callbacks.onSuccess(tagReader);
      }, 1);
    } else {
      this._findTagReader(fileReader, callbacks);
    }
  }

  _findTagReader(fileReader: MediaFileReader, callbacks: CallbackType) {
    // We don't want to make multiple fetches per tag reader to get the tag
    // identifier. The strategy here is to combine all the tag identifier
    // ranges into one and make a single fetch. This is particularly important
    // in file readers that have expensive loads like the XHR one.
    // However, with this strategy we run into the problem of loading the
    // entire file because tag identifiers might be at the start or end of
    // the file.
    // To get around this we divide the tag readers into two categories, the
    // ones that read their tag identifiers from the start of the file and the
    // ones that read from the end of the file.
    const tagReadersAtFileStart = [];
    const tagReadersAtFileEnd = [];
    const fileSize = fileReader.getSize();

    for (let i = 0; i < mediaTagReaders.length; i++) {
      const range = mediaTagReaders[i].getTagIdentifierByteRange();
      if (!isRangeValid(range, fileSize)) {
        continue;
      }

      if (
        (range.offset >= 0 && range.offset < fileSize / 2) ||
        (range.offset < 0 && range.offset < -fileSize / 2)
      ) {
        tagReadersAtFileStart.push(mediaTagReaders[i]);
      } else {
        tagReadersAtFileEnd.push(mediaTagReaders[i]);
      }
    }

    let tagsLoaded = false;
    const loadTagIdentifiersCallbacks = {
      onSuccess: () => {
        if (!tagsLoaded) {
          // We're expecting to load two sets of tag identifiers. This flag
          // indicates when the first one has been loaded.
          tagsLoaded = true;
          return;
        }

        for (let i = 0; i < mediaTagReaders.length; i++) {
          const range = mediaTagReaders[i].getTagIdentifierByteRange();
          if (!isRangeValid(range, fileSize)) {
            continue;
          }

          let tagIndentifier: number[];
          try {
            tagIndentifier = fileReader.getBytesAt(
              range.offset >= 0 ? range.offset : range.offset + fileSize,
              range.length
            );
          } catch (ex: any) {
            callbacks.onError?.({
              type: "fileReader",
              info: ex.message
            });
            return;
          }

          if (mediaTagReaders[i].canReadTagFormat(tagIndentifier)) {
            callbacks.onSuccess(mediaTagReaders[i]);
            return;
          }
        }

        callbacks.onError?.({
          type: "tagFormat",
          info: "No suitable tag reader found"
        });
      },
      onError: callbacks.onError
    };

    this._loadTagIdentifierRanges(fileReader, tagReadersAtFileStart, loadTagIdentifiersCallbacks);
    this._loadTagIdentifierRanges(fileReader, tagReadersAtFileEnd, loadTagIdentifiersCallbacks);
  }

  _loadTagIdentifierRanges(
    fileReader: MediaFileReader,
    tagReaders: typeof MediaTagReader[],
    callbacks: LoadCallbackType
  ) {
    if (tagReaders.length === 0) {
      // Force async
      setTimeout(callbacks.onSuccess, 1);
      return;
    }

    const tagIdentifierRange: [number,number] = [Number.MAX_VALUE, 0];
    const fileSize = fileReader.getSize();

    // Create a super set of all ranges so we can load them all at once.
    // Might need to rethink this approach if there are tag ranges too far
    // a part from each other. We're good for now though.
    for (let i = 0; i < tagReaders.length; i++) {
      const range = tagReaders[i].getTagIdentifierByteRange();
      const start = range.offset >= 0 ? range.offset : range.offset + fileSize;
      const end = start + range.length - 1;

      tagIdentifierRange[0] = Math.min(start, tagIdentifierRange[0]);
      tagIdentifierRange[1] = Math.max(end, tagIdentifierRange[1]);
    }

    fileReader.loadRange(tagIdentifierRange, callbacks);
  }
}

export class Config {
  static addFileReader(fileReader: typeof MediaFileReader): typeof Config {
    mediaFileReaders.push(fileReader);
    return Config;
  }

  static addTagReader(tagReader: typeof MediaTagReader): typeof Config {
    mediaTagReaders.push(tagReader);
    return Config;
  }

  static removeTagReader(tagReader: typeof MediaTagReader): typeof Config {
    const tagReaderIx = mediaTagReaders.indexOf(tagReader);

    if (tagReaderIx >= 0) {
      mediaTagReaders.splice(tagReaderIx, 1);
    }

    return Config;
  }

  static EXPERIMENTAL_avoidHeadRequests() {
    XhrFileReader.setConfig({
      avoidHeadRequests: true
    });
  }

  static setDisallowedXhrHeaders(disallowedXhrHeaders: string[]) {
    XhrFileReader.setConfig({
      disallowedXhrHeaders: disallowedXhrHeaders
    });
  }

  static setXhrTimeoutInSec(timeoutInSec: number) {
    XhrFileReader.setConfig({
      timeoutInSec: timeoutInSec
    });
  }
}

Config
  .addFileReader(XhrFileReader)
  .addFileReader(BlobFileReader)
  .addFileReader(ArrayFileReader)
  .addTagReader(ID3v2TagReader)
  .addTagReader(ID3v1TagReader)
  .addTagReader(MP4TagReader)
  .addTagReader(FLACTagReader);

// @ts-expect-error
if (typeof process !== "undefined" && !process.browser) {
  if (typeof navigator !== "undefined" && navigator.product === "ReactNative") {
    const { default: ReactNativeFileReader } = await import("./ReactNativeFileReader.js");
    Config.addFileReader(ReactNativeFileReader);
  } else {
    const { default: NodeFileReader } = await import("./NodeFileReader.js");
    Config.addFileReader(NodeFileReader);
  }
}