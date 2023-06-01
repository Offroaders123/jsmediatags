import MediaTagReader from "./MediaTagReader.js";
import MediaFileReader from "./MediaFileReader.js";
import ID3v2FrameReader from "./ID3v2FrameReader.js";

import type { ByteArray, TagFrames, TagFrame, TagHeader, TagFrameHeader, TagFrameFlags, CharsetType, ByteRange, TagType } from "./FlowTypes.js";

const ID3_HEADER_SIZE = 10;

export default class ID3v2TagReader extends MediaTagReader {
  static override getTagIdentifierByteRange(): ByteRange {
    // ID3 header
    return {
      offset: 0,
      length: ID3_HEADER_SIZE
    };
  }

  static override canReadTagFormat(tagIdentifier: ByteArray): boolean {
    const id = String.fromCharCode.apply(String, tagIdentifier.slice(0, 3));
    return id === "ID3";
  }

  public override async _loadData(mediaFileReader: MediaFileReader): Promise<void> {
    await mediaFileReader.loadRange([6, 9]);
    await mediaFileReader.loadRange(
      // The tag size does not include the header size.
      [0, ID3_HEADER_SIZE + mediaFileReader.getSynchsafeInteger32At(6) - 1]
    );
  }

  public override _parseData(data: MediaFileReader, tags?: string[] | null): TagType {
    let offset = 0;
    const major = data.getByteAt(offset+3);
    if (major > 4) {
      return {
        type: "ID3",
        version: ">2.4",
        tags: {}
      };
    }
    const revision = data.getByteAt(offset+4);
    const unsynch = data.isBitSetAt(offset+5, 7);
    const xheader = data.isBitSetAt(offset+5, 6);
    const xindicator = data.isBitSetAt(offset+5, 5);
    const size = data.getSynchsafeInteger32At(offset+6);
    offset += 10;

    if (xheader) {
      // We skip the extended header and don't offer support for it right now.
      if (major === 4) {
        const xheadersize = data.getSynchsafeInteger32At(offset);
        offset += xheadersize;
      } else {
        const xheadersize = data.getLongAt(offset, true);
        // The 'Extended header size', currently 6 or 10 bytes, excludes itself.
        offset += xheadersize + 4;
      }
    }

    const id3 = {
      type: "ID3",
      version: `2.${major}.${revision}`,
      major,
      revision,
      flags: {
        unsynchronisation: unsynch,
        extended_header: xheader,
        experimental_indicator: xindicator,
        // TODO: footer_present
        footer_present: false
      },
      size,
      tags: {},
    };

    let expandedTags: string[] | null | undefined = null;
    if (tags) {
      expandedTags = this._expandShortcutTags(tags);
    }

    let offsetEnd = size + 10/*header size*/;
    // When this flag is set the entire tag needs to be un-unsynchronised
    // before parsing each individual frame. Individual frame sizes might not
    // take unsynchronisation into consideration when it's set on the tag
    // header.
    if (id3.flags.unsynchronisation) {
      data = ID3v2FrameReader.getUnsyncFileReader(data, offset, size);
      offset = 0;
      offsetEnd = data.getSize();
    }

    const frames = ID3v2FrameReader.readFrames(offset, offsetEnd, data, id3, expandedTags);
    // create shortcuts for most common data.
    for (let name in SHORTCUTS) if (SHORTCUTS.hasOwnProperty(name)) {
      // @ts-expect-error
      const frameData = this._getFrameData(frames, SHORTCUTS[name]);
      if (frameData) {
        // @ts-expect-error
        id3.tags[name] = frameData;
      }
    }

    for (let frame in frames) if (frames.hasOwnProperty(frame)) {
      // @ts-expect-error
      id3.tags[frame] = frames[frame];
    }

    return id3;
  }

  private _getFrameData(frames: TagFrames, ids: string[]): Object | null | void {
    let frame: TagFrame;
    for (let i = 0, id; id = ids[i]; i++) {
      if (id in frames) {
        if (frames[id] instanceof Array) {
          // @ts-expect-error
          frame = frames[id][0];
        } else {
          frame = frames[id];
        }
        return frame.data;
      }
    }
  }

  override getShortcuts(): {
    [key: string]: string | string[];
  } {
    // @ts-expect-error
    return SHORTCUTS;
  }
}

const SHORTCUTS = {
  title     : ["TIT2", "TT2"],
  artist    : ["TPE1", "TP1"],
  album     : ["TALB", "TAL"],
  year      : ["TYER", "TYE"],
  comment   : ["COMM", "COM"],
  track     : ["TRCK", "TRK"],
  genre     : ["TCON", "TCO"],
  picture   : ["APIC", "PIC"],
  lyrics    : ["USLT", "ULT"]
} as const;