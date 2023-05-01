/**
 * Support for iTunes-style m4a tags
 * See:
 *   http://atomicparsley.sourceforge.net/mpeg-4files.html
 *   http://developer.apple.com/mac/library/documentation/QuickTime/QTFF/Metadata/Metadata.html
 * Authored by Joshua Kifer <joshua.kifer gmail.com>
 */

import MediaTagReader from "./MediaTagReader.js";
import MediaFileReader from "./MediaFileReader.js";

import type { CharsetType, ByteRange, TagType, TagFrame } from "./FlowTypes.js";

export default class MP4TagReader extends MediaTagReader {
  static override getTagIdentifierByteRange(): ByteRange {
    // The tag identifier is located in [4, 8] but since we'll need to reader
    // the header of the first block anyway, we load it instead to avoid
    // making two requests.
    return {
      offset: 0,
      length: 16
    };
  }

  static override canReadTagFormat(tagIdentifier: number[]): boolean {
    const id = String.fromCharCode.apply(String, tagIdentifier.slice(4, 8));
    return id === "ftyp";
  }

  public override async _loadData(mediaFileReader: MediaFileReader) {
    // MP4 metadata isn't located in a specific location of the file. Roughly
    // speaking, it's composed of blocks chained together like a linked list.
    // These blocks are called atoms (or boxes).
    // Each atom of the list can have its own child linked list. Atoms in this
    // situation do not possess any data and are called "container" as they only
    // contain other atoms.
    // Other atoms represent a particular set of data, like audio, video or
    // metadata. In order to find and load all the interesting atoms we need
    // to traverse the entire linked list of atoms and only load the ones
    // associated with metadata.
    // The metadata atoms can be find under the "moov.udta.meta.ilst" hierarchy.

    // Load the header of the first atom
    await mediaFileReader.loadRange([0, 16]);
    await this._loadAtom(mediaFileReader, 0, "");
  }

  private async _loadAtom(mediaFileReader: MediaFileReader, offset: number, parentAtomFullName: string) {
    if (offset >= mediaFileReader.getSize()) {
      return;
    }

    // 8 is the size of the atomSize and atomName fields.
    // When reading the current block we always read 8 more bytes in order
    // to also read the header of the next block.
    const atomSize = mediaFileReader.getLongAt(offset, true);
    if (atomSize == 0 || isNaN(atomSize)) {
      return;
    }
    const atomName = mediaFileReader.getStringAt(offset + 4, 4);
    // console.log(parentAtomFullName, atomName, atomSize);
    // Container atoms (no actual data)
    if (this._isContainerAtom(atomName)) {
      if (atomName == "meta") {
        // The "meta" atom breaks convention and is a container with data.
        offset += 4; // next_item_id (uint32)
      }
      const atomFullName = (parentAtomFullName ? parentAtomFullName+"." : "") + atomName;
      if (atomFullName === "moov.udta.meta.ilst") {
        await mediaFileReader.loadRange([offset, offset + atomSize]);
      } else {
        await mediaFileReader.loadRange([offset+8, offset+8 + 8]);
        await this._loadAtom(mediaFileReader, offset + 8, atomFullName);
      }
    } else {
      await mediaFileReader.loadRange([offset+atomSize, offset+atomSize + 8]);
      await this._loadAtom(mediaFileReader, offset+atomSize, parentAtomFullName);
    }
  }

  private _isContainerAtom(atomName: string): boolean {
    return ["moov", "udta", "meta", "ilst"].indexOf(atomName) >= 0;
  }

  private _canReadAtom(atomName: string): boolean {
    return atomName !== "----";
  }

  public override _parseData(data: MediaFileReader, tagsToRead?: string[] | null): TagType {
    const tags = {};

    tagsToRead = this._expandShortcutTags(tagsToRead);
    this._readAtom(tags, data, 0, data.getSize(), tagsToRead);

    // create shortcuts for most common data.
    for (let name in SHORTCUTS) if (SHORTCUTS.hasOwnProperty(name)) {
      // @ts-expect-error
      const tag = tags[SHORTCUTS[name]];
      if (tag) {
        if (name === "track") {
          // @ts-expect-error
          tags[name] = tag.data.track;
        } else {
          // @ts-expect-error
          tags[name] = tag.data;
        }
      }
    }

    return {
      type: "MP4",
      ftyp: data.getStringAt(8, 4),
      version: data.getLongAt(12, true).toString(),
      tags
    };
  }

  private _readAtom(tags: Object, data: MediaFileReader, offset: number, length: number, tagsToRead?: string[] | null, parentAtomFullName?: string, indent?: string) {
    indent = indent === undefined ? "" : indent + "  ";

    let seek = offset;
    while (seek < offset + length) {
      const atomSize = data.getLongAt(seek, true);
      if (atomSize == 0) {
        return;
      }
      const atomName = data.getStringAt(seek + 4, 4);

      // console.log(seek, parentAtomFullName, atomName, atomSize);
      if (this._isContainerAtom(atomName)) {
        if (atomName == "meta") {
          seek += 4; // next_item_id (uint32)
        }
        const atomFullName = (parentAtomFullName ? parentAtomFullName+"." : "") + atomName;
        this._readAtom(tags, data, seek + 8, atomSize - 8, tagsToRead, atomFullName, indent);
        return;
      }

      // Value atoms
      if (
        (!tagsToRead || tagsToRead.indexOf(atomName) >= 0) &&
        parentAtomFullName === "moov.udta.meta.ilst" &&
        this._canReadAtom(atomName)
      ) {
        // @ts-expect-error
        tags[atomName] = this._readMetadataAtom(data, seek);
      }

      seek += atomSize;
    }
  }

  private _readMetadataAtom(data: MediaFileReader, offset: number): TagFrame {
    // 16: size + name + size + "data" (4 bytes each)
    // 8: 1 byte atom version & 3 bytes atom flags + 4 bytes NULL space
    // 8: 4 bytes track + 4 bytes total
    const METADATA_HEADER = 16;

    const atomSize = data.getLongAt(offset, true);
    const atomName = data.getStringAt(offset + 4, 4);

    const klass = data.getInteger24At(offset + METADATA_HEADER + 1, true);
    // @ts-expect-error
    let type = TYPES[klass];
    let atomData: string | number | Record<string,string | number | number[]> | undefined;
    const bigEndian = true;
    if (atomName == "trkn") {
      atomData = {
        track: data.getShortAt(offset + METADATA_HEADER + 10, bigEndian),
        total: data.getShortAt(offset + METADATA_HEADER + 14, bigEndian)
      };
    } else if (atomName == "disk") {
      atomData = {
        disk: data.getShortAt(offset + METADATA_HEADER + 10, bigEndian),
        total: data.getShortAt(offset + METADATA_HEADER + 14, bigEndian)
      };
    } else {
      // 4: atom version (1 byte) + atom flags (3 bytes)
      // 4: NULL (usually locale indicator)
      const atomHeader = METADATA_HEADER + 4 + 4;
      const dataStart = offset + atomHeader;
      const dataLength = atomSize - atomHeader;

      // Workaround for covers being parsed as 'uint8' type despite being an 'covr' atom
      if (atomName === "covr" && type === "uint8") {
        type = "jpeg"
      }

      switch (type) {
        case "text":
        atomData = data.getStringWithCharsetAt(dataStart, dataLength, "utf-8").toString();
        break;

        case "uint8":
        atomData = data.getShortAt(dataStart, false);
        break;
        
        case "int":
        case "uint":
        // Though the QuickTime spec doesn't state it, there are 64-bit values
        // such as plID (Playlist/Collection ID). With its single 64-bit floating
        // point number type, these are hard to parse and pass in JavaScript.
        // The high word of plID seems to always be zero, so, as this is the
        // only current 64-bit atom handled, it is parsed from its 32-bit
        // low word as an unsigned long.
        //
        const intReader = type == "int"
                          ? ( dataLength == 1 ? data.getSByteAt :
                              dataLength == 2 ? data.getSShortAt :
                              dataLength == 4 ? data.getSLongAt :
                                                data.getLongAt)
                          : ( dataLength == 1 ? data.getByteAt :
                              dataLength == 2 ? data.getShortAt :
                                                data.getLongAt);
        // $FlowFixMe - getByteAt doesn't receive a second argument
        atomData = intReader.call(data, dataStart + (dataLength == 8 ? 4 : 0), true);
        break;

        case "jpeg":
        case "png":
        atomData = {
          format: `image/${type}`,
          data: data.getBytesAt(dataStart, dataLength)
        };
        break;
      }
    }

    return {
      id: atomName,
      size: atomSize,
      // @ts-expect-error
      description: ATOM_DESCRIPTIONS[atomName] || "Unknown",
      data: atomData
    };
  }

  override getShortcuts(): {
    [key: string]: string | string[];
  } {
    return SHORTCUTS;
  }
}

/*
 * https://developer.apple.com/library/content/documentation/QuickTime/QTFF/Metadata/Metadata.html#//apple_ref/doc/uid/TP40000939-CH1-SW35
*/
const TYPES = {
  0: "uint8",
  1: "text",
  13: "jpeg",
  14: "png",
  21: "int",
  22: "uint"
} as const;

const ATOM_DESCRIPTIONS = {
  "©alb": "Album",
  "©ART": "Artist",
  aART: "Album Artist",
  "©day": "Release Date",
  "©nam": "Title",
  "©gen": "Genre",
  gnre: "Genre",
  trkn: "Track Number",
  "©wrt": "Composer",
  "©too": "Encoding Tool",
  "©enc": "Encoded By",
  cprt: "Copyright",
  covr: "Cover Art",
  "©grp": "Grouping",
  keyw: "Keywords",
  "©lyr": "Lyrics",
  "©cmt": "Comment",
  tmpo: "Tempo",
  cpil: "Compilation",
  disk: "Disc Number",
  tvsh: "TV Show Name",
  tven: "TV Episode ID",
  tvsn: "TV Season",
  tves: "TV Episode",
  tvnn: "TV Network",
  desc: "Description",
  ldes: "Long Description",
  sonm: "Sort Name",
  soar: "Sort Artist",
  soaa: "Sort Album",
  soco: "Sort Composer",
  sosn: "Sort Show",
  purd: "Purchase Date",
  pcst: "Podcast",
  purl: "Podcast URL",
  catg: "Category",
  hdvd: "HD Video",
  stik: "Media Type",
  rtng: "Content Rating",
  pgap: "Gapless Playback",
  apID: "Purchase Account",
  sfID: "Country Code",
  atID: "Artist ID",
  cnID: "Catalog ID",
  plID: "Collection ID",
  geID: "Genre ID",
  "xid ": "Vendor Information",
  flvr: "Codec Flavor"
} as const;

const UNSUPPORTED_ATOMS = {
  "----": 1,
} as const;

const SHORTCUTS = {
  title     : "©nam",
  artist    : "©ART",
  album     : "©alb",
  year      : "©day",
  comment   : "©cmt",
  track     : "trkn",
  genre     : "©gen",
  picture   : "covr",
  lyrics    : "©lyr"
} as const;