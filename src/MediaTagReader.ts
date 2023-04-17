import MediaFileReader from "./MediaFileReader.js";

import type { CallbackType, LoadCallbackType, ByteRange, TagType } from "./FlowTypes.js";

export default class MediaTagReader {
  declare _mediaFileReader: MediaFileReader;
  declare _tags?: string[] | null;

  constructor(mediaFileReader: MediaFileReader) {
    this._mediaFileReader = mediaFileReader;
    this._tags = null;
  }

  /**
   * Returns the byte range that needs to be loaded and fed to
   * _canReadTagFormat in order to identify if the file contains tag
   * information that can be read.
   */
  static getTagIdentifierByteRange(): ByteRange {
    throw new Error("Must implement");
  }

  /**
   * Given a tag identifier (read from the file byte positions speficied by
   * getTagIdentifierByteRange) this function checks if it can read the tag
   * format or not.
   */
  static canReadTagFormat(tagIdentifier: number[]): boolean {
    throw new Error("Must implement");
  }

  setTagsToRead(tags: string[]): MediaTagReader {
    this._tags = tags;
    return this;
  }

  read({ onSuccess, onError }: CallbackType) {
    this._mediaFileReader.init({
      onSuccess: () => {
        this._loadData(this._mediaFileReader, {
          onSuccess: () => {
            let tags!: TagType;
            try {
              tags = this._parseData(this._mediaFileReader, this._tags);
            } catch (ex: any) {
              onError?.({
                type: "parseData",
                info: ex.message
              });
              return;
            }

            // TODO: destroy mediaFileReader
            onSuccess(tags);
          },
          onError
        });
      },
      onError
    });
  }

  getShortcuts(): {
    [key: string]: string | string[];
  } {
    return {};
  }

  /**
   * Load the necessary bytes from the media file.
   */
  _loadData(
    mediaFileReader: MediaFileReader,
    callbacks: LoadCallbackType
  ): void {
    throw new Error("Must implement _loadData function");
  }

  /**
   * Parse the loaded data to read the media tags.
   */
  _parseData(mediaFileReader: MediaFileReader, tags?: string[] | null): TagType {
    throw new Error("Must implement _parseData function");
  }

  _expandShortcutTags(tagsWithShortcuts?: string[] | null): string[] | null | undefined {
    if (!tagsWithShortcuts) {
      return null;
    }

    let tags: string[] = [];
    const shortcuts = this.getShortcuts();
    for (let i = 0, tagOrShortcut; tagOrShortcut = tagsWithShortcuts[i]; i++ ) {
      tags = tags.concat(shortcuts[tagOrShortcut]||[tagOrShortcut]);
    }

    return tags;
  }
}