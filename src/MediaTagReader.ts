import MediaFileReader from "./MediaFileReader.js";

import type { ByteRange, TagType } from "./FlowTypes.js";

export default class MediaTagReader {
  declare private _mediaFileReader: MediaFileReader;
  declare private _tags?: string[] | null;

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

  async read(): Promise<TagType> {
    await this._mediaFileReader.init();
    await this._loadData(this._mediaFileReader);

    let tags!: TagType;
    try {
      tags = this._parseData(this._mediaFileReader, this._tags);
    } catch (error: any){
      throw new Error(`parseData: ${error.message}`);
    }
    return tags;
  }

  getShortcuts(): { [key: string]: string | string[]; } {
    return {};
  }

  /**
   * Load the necessary bytes from the media file.
   */
  public async _loadData(mediaFileReader: MediaFileReader): Promise<void> {
    throw new Error("Must implement _loadData function");
  }

  /**
   * Parse the loaded data to read the media tags.
   */
  public _parseData(mediaFileReader: MediaFileReader, tags?: string[] | null): TagType {
    throw new Error("Must implement _parseData function");
  }

  protected _expandShortcutTags(tagsWithShortcuts?: string[] | null): string[] | null | undefined {
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