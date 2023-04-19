import MediaTagReader from "./MediaTagReader.js";
import MediaFileReader from "./MediaFileReader.js";

import type { ByteRange, TagType } from "./FlowTypes.js";

export default class ID3v1TagReader extends MediaTagReader {
  static override getTagIdentifierByteRange(): ByteRange {
    // The identifier is TAG and is at offset: -128. However, to avoid a
    // fetch for the tag identifier and another for the data, we load the
    // entire data since it's so small.
    return {
      offset: -128,
      length: 128
    };
  }

  static override canReadTagFormat(tagIdentifier: number[]): boolean {
    const id = String.fromCharCode.apply(String, tagIdentifier.slice(0, 3));
    return id === "TAG";
  }

  override async _loadData(mediaFileReader: MediaFileReader) {
    const fileSize = mediaFileReader.getSize();
    await mediaFileReader.loadRange([fileSize - 128, fileSize - 1]);
  }

  override _parseData(data: MediaFileReader, tags?: string[] | null): TagType {
    const offset = data.getSize() - 128;

    const title = data.getStringWithCharsetAt(offset + 3, 30).toString();
    const artist = data.getStringWithCharsetAt(offset + 33, 30).toString();
    const album = data.getStringWithCharsetAt(offset + 63, 30).toString();
    const year = data.getStringWithCharsetAt(offset + 93, 4).toString();

    const trackFlag = data.getByteAt(offset + 97 + 28);
    let track = data.getByteAt(offset + 97 + 29);
    let version: string;
    let comment: string;

    if (trackFlag == 0 && track != 0) {
      version = "1.1";
      comment = data.getStringWithCharsetAt(offset + 97, 28).toString();
    } else {
      version = "1.0";
      comment = data.getStringWithCharsetAt(offset + 97, 30).toString();
      track = 0;
    }

    const genreIdx = data.getByteAt(offset + 97 + 30);
    let genre: GENRES;
    if (genreIdx < 255) {
      genre = GENRES[genreIdx];
    } else {
      // @ts-expect-error
      genre = "";
    }

    const tag = {
      type: "ID3",
      version: version,
      tags: {
        title,
        artist,
        album,
        year,
        comment,
        genre
      }
    } as TagType;

    if (track) {
      tag.tags.track = track;
    }

    return tag;
  }
}

type GENRES = typeof GENRES[number];

const GENRES = [
  "Blues","Classic Rock","Country","Dance","Disco","Funk","Grunge",
  "Hip-Hop","Jazz","Metal","New Age","Oldies","Other","Pop","R&B",
  "Rap","Reggae","Rock","Techno","Industrial","Alternative","Ska",
  "Death Metal","Pranks","Soundtrack","Euro-Techno","Ambient",
  "Trip-Hop","Vocal","Jazz+Funk","Fusion","Trance","Classical",
  "Instrumental","Acid","House","Game","Sound Clip","Gospel",
  "Noise","AlternRock","Bass","Soul","Punk","Space","Meditative",
  "Instrumental Pop","Instrumental Rock","Ethnic","Gothic",
  "Darkwave","Techno-Industrial","Electronic","Pop-Folk",
  "Eurodance","Dream","Southern Rock","Comedy","Cult","Gangsta",
  "Top 40","Christian Rap","Pop/Funk","Jungle","Native American",
  "Cabaret","New Wave","Psychadelic","Rave","Showtunes","Trailer",
  "Lo-Fi","Tribal","Acid Punk","Acid Jazz","Polka","Retro",
  "Musical","Rock & Roll","Hard Rock","Folk","Folk-Rock",
  "National Folk","Swing","Fast Fusion","Bebob","Latin","Revival",
  "Celtic","Bluegrass","Avantgarde","Gothic Rock","Progressive Rock",
  "Psychedelic Rock","Symphonic Rock","Slow Rock","Big Band",
  "Chorus","Easy Listening","Acoustic","Humour","Speech","Chanson",
  "Opera","Chamber Music","Sonata","Symphony","Booty Bass","Primus",
  "Porn Groove","Satire","Slow Jam","Club","Tango","Samba",
  "Folklore","Ballad","Power Ballad","Rhythmic Soul","Freestyle",
  "Duet","Punk Rock","Drum Solo","Acapella","Euro-House","Dance Hall"
] as const;