import ID3v2FrameReader from '../src/ID3v2FrameReader.js';
import ArrayFileReader from '../src/ArrayFileReader.js';
import { bin } from '../src/ByteArrayUtils.js';

jest.autoMockOff();

describe("ID3v2FrameReader", () => {
  it("should read APIC tag", () => {
    var frameReader = ID3v2FrameReader.getFrameReaderFunction("APIC");

    expect(frameReader).toBeDefined();

    var fileData = [].concat(
      // @ts-expect-error
      [0x00], // text encoding
      bin("image/jpeg"), [0x00],
      [0x03], // picture type - cover front
      bin("front cover image"), [0x00],
      [0x01, 0x02, 0x03, 0x04, 0x05] // image data
    );
    var fileReader = new ArrayFileReader(fileData);
    // @ts-ignore
    var data = frameReader!(0, fileData.length, fileReader, {}, {major: 3});

    expect(data).toEqual({
      format: "image/jpeg",
      type: "Cover (front)",
      description: "front cover image",
      data: [0x01, 0x02, 0x03, 0x04, 0x05]
    });
  });

  it("should read COMM tag", () => {
    var frameReader = ID3v2FrameReader.getFrameReaderFunction("COMM");

    expect(frameReader).toBeDefined();

    var fileData = [].concat(
      // @ts-expect-error
      [0x00], // text encoding
      bin("ENG"), // language
      bin("tl;dr"), [0x00], // short text description
      bin("The entire comment that can include new lines\n.")
    );
    var fileReader = new ArrayFileReader(fileData);
    // @ts-ignore
    var data = frameReader!(0, fileData.length, fileReader, {}, {major: 3});

    expect(data).toEqual({
      language: "ENG",
      short_description: "tl;dr",
      text: "The entire comment that can include new lines\n."
    });
  });

  it("should read PIC tag", () => {
    var frameReader = ID3v2FrameReader.getFrameReaderFunction("PIC");

    expect(frameReader).toBeDefined();

    var fileData = [].concat(
      // @ts-expect-error
      [0x00], // text encoding
      bin("JPG"), // image format
      [0x03], // picture type - cover front
      bin("front cover image"), [0x00],
      [0x01, 0x02, 0x03, 0x04, 0x05] // image data
    );
    var fileReader = new ArrayFileReader(fileData);
    // @ts-ignore
    var data = frameReader!(0, fileData.length, fileReader, {}, {major: 2});

    expect(data).toEqual({
      format: "JPG",
      type: "Cover (front)",
      description: "front cover image",
      data: [0x01, 0x02, 0x03, 0x04, 0x05]
    });
  });

  it("should read PCNT tag", () => {
    var frameReader = ID3v2FrameReader.getFrameReaderFunction("PCNT");

    expect(frameReader).toBeDefined();

    // @ts-expect-error
    var fileData = [].concat(
      [0xaf, 0x19, 0x00, 0x00]
    );
    var fileReader = new ArrayFileReader(fileData);
    // @ts-ignore
    var data = frameReader!(0, fileData.length, fileReader);

    expect(data).toEqual(6575);
  });

  describe("T* text tags", () => {
    describe("T000 - TZZZ, excluding TXXX", () => {
      var frameReader = ID3v2FrameReader.getFrameReaderFunction("T*");
      var expected = "ã";

      it("asserts the function is defined", () => {
        expect(frameReader).toBeDefined();
      });

      it("should read text with iso-8859-1 charset", () => {
        var fileData = [
          0x00, // encoding
          0xe3
        ];
        var fileReader = new ArrayFileReader(fileData);
        // @ts-ignore
        var data = frameReader!(0, fileData.length, fileReader);

        expect(data).toEqual(expected);
      });

      it("should read text with utf-16 charset", () => {
        var fileData = [
          0x01, // encoding
          0xfe, 0xff, 0x00, 0xe3
        ];
        var fileReader = new ArrayFileReader(fileData);
        // @ts-ignore
        var data = frameReader!(0, fileData.length, fileReader);

        expect(data).toEqual(expected);
      });

      it("should read text with utf-16be charset", () => {
        var fileData = [
          0x02, // encoding
          0xff, 0xfe, 0xe3, 0x00
        ];
        var fileReader = new ArrayFileReader(fileData);
        // @ts-ignore
        var data = frameReader!(0, fileData.length, fileReader);

        expect(data).toEqual(expected);
      });

      it("should read text with utf-8 charset", () => {
        var fileData = [
          0x03, // encoding
          0xc3, 0xa3
        ];
        var fileReader = new ArrayFileReader(fileData);
        // @ts-ignore
        var data = frameReader!(0, fileData.length, fileReader);

        expect(data).toEqual(expected);
      });
    });

    describe("TXXX", () => {
      var frameReader = ID3v2FrameReader.getFrameReaderFunction("TXXX");
      var expected = {
        user_description: "ã",
        data: "ã"
      };

      it("asserts the ID3v2FrameReader is defined", () => {
        expect(frameReader).toBeDefined();
      });

      it("reads the description and value with iso-8859-1 charset", () => {
        var fileData = [
          // encoding
          0x00,
          // "ã" for description field
          0xe3,
          // null terminating byte
          0x00,
          // "ã" for URL field
          0xe3
        ];
        var fileReader = new ArrayFileReader(fileData);
        // @ts-ignore
        var data = frameReader!(0, fileData.length, fileReader);

        expect(data).toEqual(expected);
      });

      it("reads the description and value with utf-16 charset", () => {
        var fileData = [].concat(
          // @ts-expect-error
          [0x01], // encoding
          [0xfe, 0xff, 0x00, 0xe3, 0x00, 0x00],
          [0xfe, 0xff, 0x00, 0xe3, 0x00, 0x00]
        );
        var fileReader = new ArrayFileReader(fileData);
        // @ts-ignore
        var data = frameReader!(0, fileData.length, fileReader);

        expect(data).toEqual(expected);
      });

      it("reads the description and value with utf-16be charset", () => {
        var fileData = [].concat(
          // @ts-expect-error
          [0x02], // encoding
          [0xff, 0xfe, 0xe3, 0x00, 0x00, 0x00],
          [0xff, 0xfe, 0xe3, 0x00, 0x00, 0x00]
        );
        var fileReader = new ArrayFileReader(fileData);
        // @ts-ignore
        var data = frameReader!(0, fileData.length, fileReader);

        expect(data).toEqual(expected);
      });

      it("reads the description and value with utf-8 charset", () => {
        var fileData = [].concat(
          // @ts-expect-error
          [0x03], // encoding
          [0xc3, 0xa3, 0x00],
          [0xc3, 0xe3, 0x00]
        );
        var fileReader = new ArrayFileReader(fileData);
        // @ts-ignore
        var data = frameReader!(0, fileData.length, fileReader);

        expect(data).toEqual(expected);
      });
    });
  });

  describe("W* URL tags", () => {
    var frameReader = ID3v2FrameReader.getFrameReaderFunction("W*");

    it("asserts the ID3v2FrameReader is defined", () => {
      expect(frameReader).toBeDefined();
    });

    describe("W000 - WZZZ, excluding WXXX", () => {
      it("should read urls with iso-8859-1 charset", () => {
        var fileData = [0xe3];
        var fileReader = new ArrayFileReader(fileData);
        // @ts-ignore
        var data = frameReader!(0, fileData.length, fileReader);

        expect(data).toEqual("ã");
      });
    });

    describe("WXXX", () => {
      var frameReader = ID3v2FrameReader.getFrameReaderFunction("WXXX");
      var expected = {
        user_description: "ã",
        data: "ã"
      };

      it("asserts the ID3v2FrameReader is defined", () => {
        expect(frameReader).toBeDefined();
      });

      it("reads both description and url with iso-8859-1 charset", () => {
        var fileData = [
          // encoding
          0x00,
          // "ã" for description field
          0xe3,
          // null terminating byte
          0x00,
          // "ã" for URL field
          0xe3
        ];
        var fileReader = new ArrayFileReader(fileData);
        // @ts-ignore
        var data = frameReader!(0, fileData.length, fileReader);

        expect(data).toEqual(expected);
      });

      it("reads the description and url with utf-16 charset", () => {
        var fileData = [].concat(
          // @ts-expect-error
          [0x01], // encoding
          [0xfe, 0xff, 0x00, 0xe3, 0x00, 0x00],
          [0xfe, 0xff, 0x00, 0xe3, 0x00, 0x00]
        );
        var fileReader = new ArrayFileReader(fileData);
        // @ts-ignore
        var data = frameReader!(0, fileData.length, fileReader);

        expect(data).toEqual(expected);
      });

      it("reads the description and url with utf-16be charset", () => {
        var fileData = [].concat(
          // @ts-expect-error
          [0x02], // encoding
          [0xff, 0xfe, 0xe3, 0x00, 0x00, 0x00],
          [0xff, 0xfe, 0xe3, 0x00, 0x00, 0x00]
        );
        var fileReader = new ArrayFileReader(fileData);
        // @ts-ignore
        var data = frameReader!(0, fileData.length, fileReader);

        expect(data).toEqual(expected);
      });

      it("reads the description and url with utf-8 charset", () => {
        var fileData = [].concat(
          // @ts-expect-error
          [0x03], // encoding
          [0xc3, 0xa3, 0x00],
          [0xc3, 0xe3, 0x00]
        );
        var fileReader = new ArrayFileReader(fileData);
        // @ts-ignore
        var data = frameReader!(0, fileData.length, fileReader);

        expect(data).toEqual(expected);
      });
    });
  });

  it("should read TCON tag", () => {
    var frameReader = ID3v2FrameReader.getFrameReaderFunction("TCON");

    expect(frameReader).toBeDefined();

    var fileData = [].concat(
      // @ts-expect-error
      [0x00], // encoding
      bin("(10)Eurodisc")
    );
    var fileReader = new ArrayFileReader(fileData);
    // @ts-ignore
    var data = frameReader!(0, fileData.length, fileReader);

    expect(data).toEqual("Eurodisc");
  });

  it("should read USLT tag", () => {
    var frameReader = ID3v2FrameReader.getFrameReaderFunction("USLT");

    expect(frameReader).toBeDefined();

    var fileData = [].concat(
      // @ts-expect-error
      [0x00], // encoding
      bin("POR"), // language
      [0x00], // content descriptor
      bin("Se eu soubesse tinha ido com a Sofia")
    );
    var fileReader = new ArrayFileReader(fileData);
    // @ts-ignore
    var data = frameReader!(0, fileData.length, fileReader);

    expect(data).toEqual({
      language: "POR",
      descriptor: "",
      lyrics: "Se eu soubesse tinha ido com a Sofia"
    });
  });

  it("should read CTOC tag", () => {
    var frameReader = ID3v2FrameReader.getFrameReaderFunction("CTOC")!.bind(ID3v2FrameReader);

    expect(frameReader).toBeDefined();

    var fileData = [].concat(
      // @ts-expect-error
      bin("ID1"), // ID
      [0x00], // null terminated
      [0b00000011], // toplevel/ordered bit
      [0x02], // entry count
      bin("ID2"), [0x00], // child 1
      bin("ID3"), [0x00], // child 2
      bin("TIT1"), // child 1
        [0x00, 0x00, 0x00, 0x02], // size
        [0x00, 0x00], // flags
        [0x00, 0x00], // text encoding + null terminated string
      bin("TIT2"), // child 2
        [0x00, 0x00, 0x00, 0x02], // size
        [0x00, 0x00], // flags
        [0x00, 0x00] // text encoding + null terminated string
    );
    var fileReader = new ArrayFileReader(fileData);
    // @ts-ignore
    var data = frameReader!(0, fileData.length, fileReader, null, {major: 3});

    expect(data).toEqual({
      id: "ID1",
      topLevel: true,
      ordered: true,
      entryCount: 2,
      childElementIds: [ "ID2", "ID3" ],
      subFrames: {
        TIT1: {
          data: '',
          description: 'Content group description',
          id: 'TIT1',
          size: 2
        },
        TIT2: {
          data: '',
          description: 'Title/songname/content description',
          id: 'TIT2',
          size: 2
        }
      }
    });
  });

  it("should read CHAP tag", () => {
    var frameReader = ID3v2FrameReader.getFrameReaderFunction("CHAP")!.bind(ID3v2FrameReader);

    expect(frameReader).toBeDefined();

    var fileData = [].concat(
      // @ts-expect-error
      bin("ID1"), // ID
      [0x00], // null terminated
      [0x00, 0x00, 0x00, 0xff], // start time
      [0x00, 0x00, 0x01, 0xff], // end time
      [0x00, 0x00, 0x02, 0xff], // start offset
      [0x00, 0x00, 0x03, 0xff] // end offset
    );
    var fileReader = new ArrayFileReader(fileData);
    // @ts-ignore
    var data = frameReader!(0, fileData.length, fileReader, null, {major: 3});

    expect(data).toEqual({
      id: 'ID1',
      startTime: 255,
      endTime: 511,
      startOffset: 767,
      endOffset: 1023,
      subFrames: {}
    });
  });

  it("should ignore faulty MP3ext padding", () => {
    var artistName = bin("Lead Artist");
    var mp3extPadding = bin("MP3ext V3.3.19(ansi) MP3ext V3.3.19(ansi)");
    var fileData = [].concat(
      // Good tag
      // @ts-expect-error
      bin("TPE1"),
      [0x00, 0x00, 0x00, 1 + artistName.length], // size
      [0x00, 0x00], // flags
      [0x00], // text encoding
      artistName, // content
      // MP3ext faulty padding
      mp3extPadding
    );
    var fileReader = new ArrayFileReader(fileData);
    var id3header = {major: 4};

    var tags = ID3v2FrameReader.readFrames(
      // @ts-ignore
      0, fileData.length, fileReader, id3header
    );
    expect(tags.MP3e).not.toBeDefined();
  });

  // Some tags were found to have padding but no extended header declaring the
  // padding size (https://github.com/aadsm/jsmediatags/issues/69).
  it("should ignore undeclared padding", () => {
    var artistName = bin("Lead Artist");
    var fileData = [].concat(
      // @ts-expect-error
      bin("TPE1"),
      [0x00, 0x00, 0x00, 1 + artistName.length], // size
      [0x00, 0x00], // flags
      [0x00], // text encoding
      artistName, // content
      // undeclared padding
      [0x00, 0x00]
    );
    var fileReader = new ArrayFileReader(fileData);
    var id3header = {major: 4};

    var tags = ID3v2FrameReader.readFrames(
      0,
      fileData.length,
      fileReader,
      // @ts-ignore
      id3header
    );
  });

  it("should read UFID tag", () => {
    var frameReader = ID3v2FrameReader.getFrameReaderFunction("UFID");

    expect(frameReader).toBeDefined();

    var fileData = [].concat(
      // @ts-expect-error
      bin("http://www.id3.org/dummy/ufid.html"), [0x00], // owner identifier
      [0x01, 0x02, 0x03] // identifier
    );
    var fileReader = new ArrayFileReader(fileData);
    // @ts-ignore
    var data = frameReader!(0, fileData.length, fileReader);

    expect(data).toEqual({
      ownerIdentifier: "http://www.id3.org/dummy/ufid.html",
      identifier: [0x01, 0x02, 0x03]
    });
  });
});