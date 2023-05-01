import MediaFileReader from "./MediaFileReader.js";
import MediaTagReader from "./MediaTagReader.js";

import type { ByteRange, TagType, PictureType } from "./FlowTypes.js";

/*
 * The first 4 bytes of a FLAC file describes the header for the file. If these
 * bytes respectively read "fLaC", we can determine it is a FLAC file.
 */

const FLAC_HEADER_SIZE = 4;

/*
 * FLAC metadata is stored in blocks containing data ranging from STREAMINFO to
 * VORBIS_COMMENT, which is what we want to work with.
 *
 * Each metadata header is 4 bytes long, with the first byte determining whether
 * it is the last metadata block before the audio data and what the block type is.
 * This first byte can further be split into 8 bits, with the first bit being the
 * last-metadata-block flag, and the last three bits being the block type.
 *
 * Since the specification states that the decimal value for a VORBIS_COMMENT block
 * type is 4, the two possibilities for the comment block header values are:
 * - 00000100 (Not a last metadata comment block, value of 4)
 * - 10000100 (A last metadata comment block, value of 132)
 *
 * Similarly, the picture block header values are 6 and 128.
 *
 * All values for METADATA_BLOCK_HEADER can be found here.
 * https://xiph.org/flac/format.html#metadata_block_header
 */

type COMMENT_HEADERS = typeof COMMENT_HEADERS[number];

const COMMENT_HEADERS = [4, 132] as const;

type PICTURE_HEADERS = typeof PICTURE_HEADERS[number];

const PICTURE_HEADERS = [6, 134] as const;

/**
 * These are the possible image types as defined by the FLAC specification.
 */
const IMAGE_TYPES = [
  "Other",
  "32x32 pixels 'file icon' (PNG only)",
  "Other file icon",
  "Cover (front)",
  "Cover (back)",
  "Leaflet page",
  "Media (e.g. label side of CD)",
  "Lead artist/lead performer/soloist",
  "Artist/performer",
  "Conductor",
  "Band/Orchestra",
  "Composer",
  "Lyricist/text writer",
  "Recording Location",
  "During recording",
  "During performance",
  "Movie/video screen capture",
  "A bright coloured fish",
  "Illustration",
  "Band/artist logotype",
  "Publisher/Studio logotype"
] as const;

/**
 * Class representing a MediaTagReader that parses FLAC tags.
 */
export default class FLACTagReader extends MediaTagReader {
  declare _commentOffset: number;
  declare _pictureOffset: number;

  /**
   * Gets the byte range for the tag identifier.
   *
   * Because the Vorbis comment block is not guaranteed to be in a specified
   * location, we can only load the first 4 bytes of the file to confirm it
   * is a FLAC first.
   *
   * @return The byte range that identifies the tag for a FLAC.
   */
  static override getTagIdentifierByteRange(): ByteRange {
    return {
      offset: 0,
      length: FLAC_HEADER_SIZE
    };
  }

  /**
   * Determines whether or not this reader can read a certain tag format.
   *
   * This checks that the first 4 characters in the file are fLaC, which
   * according to the FLAC file specification should be the characters that
   * indicate a FLAC file.
   *
   * @return True if the header is fLaC, false otherwise.
   */
  static override canReadTagFormat(tagIdentifier: number[]): boolean {
    const id = String.fromCharCode.apply(String, tagIdentifier.slice(0, 4));
    return id === "fLaC";
  }

  /**
   * Function called to load the data from the file.
   *
   * To begin processing the blocks, the next 4 bytes after the initial 4 bytes
   * (bytes 4 through 7) are loaded. From there, the rest of the loading process
   * is passed on to the _loadBlock function, which will handle the rest of the
   * parsing for the metadata blocks.
   *
   * @param mediaFileReader - The MediaFileReader used to parse the file.
   * @param callbacks - The callback to call once _loadData is completed.
   */
  override async _loadData(mediaFileReader: MediaFileReader) {
    await mediaFileReader.loadRange([4, 7]);
    await this._loadBlock(mediaFileReader, 4);
  }

  /**
   * Special internal function used to parse the different FLAC blocks.
   *
   * The FLAC specification doesn't specify a specific location for metadata to resign, but
   * dictates that it may be in one of various blocks located throughout the file. To load the
   * metadata, we must locate the header first. This can be done by reading the first byte of
   * each block to determine the block type. After the block type comes a 24 bit integer that stores
   * the length of the block as big endian. Using this, we locate the block and store the offset for
   * parsing later.
   *
   * After each block has been parsed, the _nextBlock function is called in order
   * to parse the information of the next block. All blocks need to be parsed in order to find
   * all of the picture and comment blocks.
   *
   * More info on the FLAC specification may be found here:
   * https://xiph.org/flac/format.html
   * 
   * @param mediaFileReader - The MediaFileReader used to parse the file.
   * @param offset - The offset to start checking the header from.
   * @return - The callback to call once the header has been found.
   */
  async _loadBlock(mediaFileReader: MediaFileReader, offset: number) {
    /**
     * As mentioned above, this first byte is loaded to see what metadata type
     * this block represents.
     */
    const blockHeader = mediaFileReader.getByteAt(offset);
    /**
     * The last three bytes (integer 24) contain a value representing the length
     * of the following metadata block. The 1 is added in order to shift the offset
     * by one to get the last three bytes in the block header.
     */
    const blockSize = mediaFileReader.getInteger24At(offset + 1, true);
    /**
     * This conditional checks if blockHeader (the byte retrieved representing the
     * type of the header) is one the headers we are looking for.
     *
     * If that is not true, the block is skipped over and the next range is loaded:
     * - offset + 4 + blockSize adds 4 to skip over the initial metadata header and
     * blockSize to skip over the block overall, placing it at the head of the next
     * metadata header.
     * - offset + 4 + 4 + blockSize does the same thing as the previous block with
     * the exception of adding another 4 bytes to move it to the end of the new metadata
     * header.
     */
    if (COMMENT_HEADERS.indexOf(blockHeader as COMMENT_HEADERS) !== -1) {
      /**
       * 4 is added to offset to move it to the head of the actual metadata.
       * The range starting from offsetMatadata (the beginning of the block)
       * and offsetMetadata + blockSize (the end of the block) is loaded.
       */
      const offsetMetadata = offset + 4;
      await mediaFileReader.loadRange([offsetMetadata, offsetMetadata + blockSize]);
      this._commentOffset = offsetMetadata;
      await this._nextBlock(mediaFileReader, offset, blockHeader, blockSize);
    } else if (PICTURE_HEADERS.indexOf(blockHeader as PICTURE_HEADERS) !== -1) {
      const offsetMetadata = offset + 4;
      await mediaFileReader.loadRange([offsetMetadata, offsetMetadata + blockSize]);
      this._pictureOffset = offsetMetadata;
      await this._nextBlock(mediaFileReader, offset, blockHeader, blockSize);
    } else {
      await this._nextBlock(mediaFileReader, offset, blockHeader, blockSize);
    }
  }

  /**
   * Internal function used to load the next range and respective block.
   *
   * If the metadata block that was identified is not the last block before the
   * audio blocks, the function will continue loading the next blocks. If it is
   * the last block (identified by any values greater than 127, see FLAC spec.),
   * the function will determine whether a comment block had been identified.
   *
   * If the block does not exist, the error callback is called. Otherwise, the function
   * will call the success callback, allowing data parsing to begin.
   * 
   * @param mediaFileReader - The MediaFileReader used to parse the file.
   * @param offset - The offset that the existing header was located at.
   * @param blockHeader - An integer reflecting the header type of the block.
   * @param blockSize - The size of the previously processed header.
   * @return - The callback functions to be called.
   */
  async _nextBlock(mediaFileReader: MediaFileReader, offset: number, blockHeader: number, blockSize: number) {
    if (blockHeader > 127) {
      if (!this._commentOffset) {
        throw new Error("loadData: Comment block could not be found.");
      } else {
        return;
      }
    } else {
      await mediaFileReader.loadRange([offset + 4 + blockSize, offset + 4 + 4 + blockSize]);
      await this._loadBlock(mediaFileReader, offset + 4 + blockSize);
    }
  }

  /**
   * Parses the data and returns the tags.
   *
   * This is an overview of the VorbisComment format and what this function attempts to
   * retrieve:
   * - First 4 bytes: a long that contains the length of the vendor string.
   * - Next n bytes: the vendor string encoded in UTF-8.
   * - Next 4 bytes: a long representing how many comments are in this block
   * For each comment that exists:
   * - First 4 bytes: a long representing the length of the comment
   * - Next n bytes: the comment encoded in UTF-8.
   * The comment string will usually appear in a format similar to:
   * ARTIST=me
   *
   * Note that the longs and integers in this block are encoded in little endian
   * as opposed to big endian for the rest of the FLAC spec.
   * 
   * @param data - The MediaFileReader to parse the file with.
   * @param tags - Optional tags to also be retrieved from the file.
   * @return - An object containing the tag information for the file.
   */
  override _parseData(data: MediaFileReader, tags?: string[]): TagType {
    const vendorLength = data.getLongAt(this._commentOffset, false);
    const offsetVendor = this._commentOffset + 4;
    /* This line is able to retrieve the vendor string that the VorbisComment block
     * contains. However, it is not part of the tags that JSMediaTags normally retrieves,
     * and is therefore commented out.
     */
    // const vendor = data.getStringWithCharsetAt(offsetVendor, vendorLength, "utf-8").toString();
    const offsetList = vendorLength + offsetVendor;
    /* To get the metadata from the block, we first get the long that contains the
     * number of actual comment values that are existent within the block.
     *
     * As we loop through all of the comment blocks, we get the data length in order to
     * get the right size string, and then determine which category that string falls under.
     * The dataOffset variable is constantly updated so that it is at the beginning of the
     * comment that is currently being parsed.
     *
     * Additions of 4 here are used to move the offset past the first 4 bytes which only contain
     * the length of the comment.
     */
    const numComments = data.getLongAt(offsetList, false);
    let dataOffset = offsetList + 4;
    let title: string | undefined;
    let artist: string | undefined;
    let album: string | undefined;
    let track: string | undefined;
    let genre: string | undefined;
    let picture: PictureType | undefined;
    for (let i = 0; i < numComments; i++) {
      const dataLength = data.getLongAt(dataOffset, false);
      const s = data.getStringWithCharsetAt(dataOffset + 4, dataLength, "utf-8").toString();
      const d = s.indexOf("=");
      const split = [s.slice(0, d), s.slice(d + 1)];
      switch (split[0].toUpperCase()) {
        case "TITLE":
          title = split[1];
          break;
        case "ARTIST":
          artist = split[1];
          break;
        case "ALBUM":
          album = split[1];
          break;
        case "TRACKNUMBER":
          track = split[1];
          break;
        case "GENRE":
          genre = split[1];
          break;
      }
      dataOffset += 4 + dataLength;
    }

    /* If a picture offset was found and assigned, then the reader will start processing
     * the picture block from that point.
     *
     * All the lengths for the picture data can be found online here:
     * https://xiph.org/flac/format.html#metadata_block_picture
     */
    if (this._pictureOffset) {
      const imageType = data.getLongAt(this._pictureOffset, true);
      const offsetMimeLength = this._pictureOffset + 4;
      const mimeLength = data.getLongAt(offsetMimeLength, true);
      const offsetMime = offsetMimeLength + 4;
      const mime = data.getStringAt(offsetMime, mimeLength);
      const offsetDescriptionLength = offsetMime + mimeLength;
      const descriptionLength = data.getLongAt(offsetDescriptionLength, true);
      const offsetDescription = offsetDescriptionLength + 4;
      const description = data.getStringWithCharsetAt(offsetDescription, descriptionLength, "utf-8").toString();
      const offsetDataLength = offsetDescription + descriptionLength + 16;
      const dataLength = data.getLongAt(offsetDataLength, true);
      const offsetData = offsetDataLength + 4;
      const imageData = data.getBytesAt(offsetData, dataLength);
      picture = {
        format: mime,
        type: IMAGE_TYPES[imageType],
        description,
        data: imageData
      }
    }

    const tag = {
      type: "FLAC",
      version: "1",
      tags: {
        title,
        artist,
        album,
        track,
        genre,
        picture
      }
    } as TagType;
    return tag;
  }
}