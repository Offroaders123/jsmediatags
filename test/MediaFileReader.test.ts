import { jest } from "@jest/globals";

import MediaFileReader from "../src/MediaFileReader.js";

jest
  .dontMock("../src/MediaFileReader.js")
  .dontMock("../src/StringUtils.js");

describe("MediaFileReader", () => {
  let mediaFileReader: MediaFileReader;
  let mediaFileBytes: number[] = [];

  beforeEach(() => {
    mediaFileReader = new MediaFileReader();
    mediaFileReader.getByteAt =
      jest.fn<typeof mediaFileReader.getByteAt>().mockImplementation(offset => {
        return mediaFileBytes[offset];
      });
  });

  it("should throw when trying to get the size before init()", () => {
    expect(() => {
      mediaFileReader.getSize();
    }).toThrow(new Error("init() must be called first."));
  });

  describe("isBitSetAt", () => {
    beforeEach(() => {
      mediaFileBytes = [0x0f];
    });

    it("should check if a bit is set", () => {
      const isSet = mediaFileReader.isBitSetAt(0, 0);
      expect(isSet).toBe(true);
    });

    it("should check if a bit is not set", () => {
      const isSet = mediaFileReader.isBitSetAt(0, 7);
      expect(isSet).toBe(false);
    });
  });

  it("should read bytes", () => {
    mediaFileBytes = [0x01, 0x02, 0x03, 0x04];
    const bytes = mediaFileReader.getBytesAt(0, 4);
    expect(bytes).toEqual(mediaFileBytes);
  });

  describe("getSByteAt", () => {
    it("should read a signed byte", () => {
      mediaFileBytes = [0xff];
      const iByte = mediaFileReader.getSByteAt(0);
      expect(iByte).toBe(-1);
    });

    it("should read a signed byte", () => {
      mediaFileBytes = [0x01];
      const iByte = mediaFileReader.getSByteAt(0);
      expect(iByte).toBe(1);
    });
  });

  describe("getShortAt", () => {
    it("should read an unsigned short in big endian", () => {
      mediaFileBytes = [0xf0, 0x00];
      const iShort = mediaFileReader.getShortAt(0, true);
      expect(iShort).toBe(61440);
    });

    it("should read an unsigned short in little endian", () => {
      mediaFileBytes = [0x00, 0xf0];
      const iShort = mediaFileReader.getShortAt(0, false);
      expect(iShort).toBe(61440);
    });
  });

  describe("getSShortAt", () => {
    it("should read an signed short in big endian", () => {
      mediaFileBytes = [0xf0, 0x00];
      const iShort = mediaFileReader.getSShortAt(0, true);
      expect(iShort).toBe(-4096);
    });

    it("should read an signed short in little endian", () => {
      mediaFileBytes = [0x00, 0xf0];
      const iShort = mediaFileReader.getSShortAt(0, false);
      expect(iShort).toBe(-4096);
    });
  });

  describe("getLongAt", () => {
    it("should read an unsigned long in big endian", () => {
      mediaFileBytes = [0xf0, 0x00, 0x00, 0x00];
      const iLong = mediaFileReader.getLongAt(0, true);
      expect(iLong).toBe(4026531840);
    });

    it("should read an unsigned long in little endian", () => {
      mediaFileBytes = [0x00, 0x00, 0x00, 0xf0];
      const iLong = mediaFileReader.getLongAt(0, false);
      expect(iLong).toBe(4026531840);
    });
  });

  describe("getSLongAt", () => {
    it("should read an signed long in big endian", () => {
      mediaFileBytes = [0xf0, 0x00, 0x00, 0x00];
      const iLong = mediaFileReader.getSLongAt(0, true);
      expect(iLong).toBe(-268435456);
    });

    it("should read an signed long in little endian", () => {
      mediaFileBytes = [0x00, 0x00, 0x00, 0xf0];
      const iLong = mediaFileReader.getSLongAt(0, false);
      expect(iLong).toBe(-268435456);
    });
  });

  describe("getSLongAt", () => {
    it("should read a 24bit integer in big endian", () => {
      mediaFileBytes = [0xf0, 0x00, 0x00];
      const iInt = mediaFileReader.getInteger24At(0, true);
      expect(iInt).toBe(15728640);
    });

    it("should read a 24bit integer in little endian", () => {
      mediaFileBytes = [0x00, 0x00, 0xf0];
      const iInt = mediaFileReader.getInteger24At(0, false);
      expect(iInt).toBe(15728640);
    });
  });

  it("should read a string at offset", () => {
    mediaFileBytes = [0x48, 0x65, 0x6c, 0x6c, 0x6f];
    const string = mediaFileReader.getStringAt(0, 5);
    expect(string).toBe("Hello");
  });

  describe("getStringWithCharsetAt", () => {
    it("should a null terminated string", () => {
      mediaFileBytes = [0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x00];
      // @ts-expect-error
      const string = mediaFileReader.getStringWithCharsetAt(0, 6, "ascii");

      expect(string.length).toBe(5);

      expect(string.toString()).toEqual("Hello");
    });

    it("should a utf-8 string", () => {
      // Olá in UTF-8
      mediaFileBytes = [0x4f, 0x6c, 0xc3, 0xa1];
      const string = mediaFileReader.getStringWithCharsetAt(0, 4, "utf-8");

      expect(string.length).toBe(3);

      expect(string.toString()).toEqual("Olá");
    });

    it("should a utf-16 BE-BOM header string", () => {
      // Olá in UTF-16BE
      mediaFileBytes = [0xfe, 0xff, 0x00, 0x4f, 0x00, 0x6c, 0x00, 0xe1];
      const string = mediaFileReader.getStringWithCharsetAt(0, 8, "utf-16");

      expect(string.length).toBe(3);

      expect(string.toString()).toEqual("Olá");
    });

    it("should a utf-16 LE-BOM header string", () => {
      // Olá in UTF-16BE
      mediaFileBytes = [0xff, 0xfe, 0x4f, 0x00, 0x6c, 0x00, 0xe1, 0x00];
      const string = mediaFileReader.getStringWithCharsetAt(0, 8, "utf-16");

      expect(string.length).toBe(3);

      expect(string.toString()).toEqual("Olá");
    });

    it("should a utf-16be string", () => {
      // Olá in UTF-16BE
      mediaFileBytes = [0x00, 0x4f, 0x00, 0x6c, 0x00, 0xe1];
      const string = mediaFileReader.getStringWithCharsetAt(0, 6, "utf-16be");

      expect(string.length).toBe(3);

      expect(string.toString()).toEqual("Olá");
    });

    it("should a utf-16le string", () => {
      // Olá in UTF-16LE
      mediaFileBytes = [0x4f, 0x00, 0x6c, 0x00, 0xe1, 0x00];
      const string = mediaFileReader.getStringWithCharsetAt(0, 6, "utf-16le");

      expect(string.length).toBe(3);

      expect(string.toString()).toEqual("Olá");
    });
  });

  it("should read a char", () => {
    mediaFileBytes = [0x61];
    const string = mediaFileReader.getCharAt(0);

    expect(string.toString()).toEqual("a");
  });
});