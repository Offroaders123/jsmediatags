import { jest, describe, beforeEach, it, expect } from "@jest/globals";

import ID3v2TagReader from "../src/ID3v2TagReader.js";
import ID3v2TagContents from "../src/ID3v2TagContents.js";
import ArrayFileReader from "../src/ArrayFileReader.js";

import { bin } from "../src/ByteArrayUtils";

jest
  .autoMockOff()
  .useRealTimers();

describe("ID3v2TagReader", () => {
  let tagReader: ID3v2TagReader;
  let mediaFileReader: ArrayFileReader;
  const id3FileContents =
    new ID3v2TagContents(4, 3)
      .addFrame("TIT2", [].concat(
        // @ts-expect-error
        [0x00], // encoding
        bin("The title"), [0x00]
      ))
      .addFrame("TCOM", [].concat(
        // @ts-expect-error
        [0x00], // encoding
        bin("The Composer"), [0x00]
      ))
      .addFrame("\u0000\u0000\u0000\u0000", []); // Padding frame

  beforeEach(() => {
    mediaFileReader = new ArrayFileReader(id3FileContents.toArray());
    tagReader = new ID3v2TagReader(mediaFileReader);
  });

  describe("header", () => {
    it("reads an header", async () => {
      const tags = await tagReader.read();

      // @ts-ignore
      delete tags.tags;
      expect(tags).toEqual({
        type: "ID3",
        version: "2.4.3",
        flags: {
          experimental_indicator: false,
          extended_header: false,
          unsynchronisation: false,
          footer_present: false
        },
        major: 4,
        revision: 3,
        size: 55
      });
    });
    
    it("reads an header with extended header", async () => {
      const tags = await tagReader.read();
      const id3FileContents = new ID3v2TagContents(4, 3)
        .addFrame("TIT2", [].concat(
          // @ts-expect-error
          [0],
          bin("The title"), [0]
        ))
        .addFrame("TCOM", [].concat(
          // @ts-expect-error
          [0],
          bin("The Composer"), [0]
        ))
        .setTagIsUpdate();

      mediaFileReader = new ArrayFileReader(id3FileContents.toArray());
      tagReader = new ID3v2TagReader(mediaFileReader);

      expect("TIT2" in tags.tags).toBeTruthy();
      expect("TCOM" in tags.tags).toBeTruthy();
      // @ts-ignore
      delete tags.tags;
      expect(tags).toEqual({
        type: "ID3",
        version: "2.4.3",
        flags: {
          experimental_indicator: false,
          extended_header: true,
          unsynchronisation: false,
          footer_present: false
        },
        major: 4,
        revision: 3,
        size: 51
      });
    });

  });

  it("loads the entire tag", async () => {
    mediaFileReader.loadRange = jest.fn<typeof mediaFileReader.loadRange>().mockImplementation(
      (...args) => {
        return ArrayFileReader.prototype.loadRange.apply(this, args);
      }
    );

    await tagReader.read();
    // The first call is the initial load to figure out the tag ID.
    // @ts-ignore
    let callArguments = mediaFileReader.loadRange.mock.calls[1];
    expect(callArguments[0]).toEqual([0, mediaFileReader._array.length - 1]);
  });

  it("reads tags", async () => {
    const tags = await tagReader.read();
    expect("TIT2" in tags.tags).toBeTruthy();
    expect(tags.tags.TIT2).toEqual({
      id: "TIT2",
      size: 11,
      description: "Title/songname/content description",
      data: "The title"
    });
  });

  it("reads tags as shortcuts", async () => {
    const tags = await tagReader.read();
    expect(tags.tags.title).toBe("The title");
  });

  it("reads all tags when none is specified", async () => {
    const tags = await tagReader.read();
    expect(Object.keys(tags.tags)).toContain("TIT2");
    expect(Object.keys(tags.tags)).toContain("TCOM");
  });

  it("reads the specificed tag", async () => {
    const tags = await tagReader.setTagsToRead(["TCOM"])
      .read();
    expect(Object.keys(tags.tags)).not.toContain("TIT2");
    expect(Object.keys(tags.tags)).toContain("TCOM");
  });

  it("should ignore empty tags", async () => {
    const tags = await tagReader.read();
    expect(Object.keys(tags.tags)).not.toContain("\u0000\u0000\u0000\u0000");
  });

  describe("unsynchronisation", () => {
    it("reads global unsynchronised content", async () => {
      const id3FileContents =
        new ID3v2TagContents(4, 3)
        // @ts-ignore
          .setFlags({
            unsynchronisation: true
          })
          .addFrame("TIT2", [].concat(
            // @ts-expect-error
            [0x00], // encoding
            bin("The title"), [0x00]
          ))
          .addFrame("APIC", [].concat(
            // @ts-expect-error
            [0x00], // text encoding
            bin("image/jpeg"), [0x00],
            [0x03], // picture type - cover front
            bin("front cover image"), [0x00],
            [0x01, 0x02, 0xff, 0x00, 0x03, 0x04, 0x05] // image data
          ));
      mediaFileReader = new ArrayFileReader(id3FileContents.toArray());
      tagReader = new ID3v2TagReader(mediaFileReader);

      const tags = await tagReader.read();

      expect(tags.tags.title).toBe("The title");
      expect(tags.tags.picture!.data).toEqual([1, 2, 255, 3, 4, 5]);
    });

    it("reads local unsynchronised content", async () => {
      const id3FileContents =
        new ID3v2TagContents(4, 3)
          .addFrame("TIT2", [].concat(
            // @ts-expect-error
            [0x00], // encoding
            bin("The title"), [0x00]
          ))
          .addFrame("APIC", [].concat(
            // @ts-expect-error
            [0x00], // text encoding
            bin("image/jpeg"), [0x00],
            [0x03], // picture type - cover front
            bin("front cover image"), [0x00],
            [0x01, 0x02, 0xff, 0x00, 0x03, 0x04, 0x05] // image data
          ), {
            // @ts-ignore
            format: {
              unsynchronisation: true
            }
          });
      mediaFileReader = new ArrayFileReader(id3FileContents.toArray());
      tagReader = new ID3v2TagReader(mediaFileReader);

      const tags = await tagReader.read();
      expect(tags.tags.picture!.data).toEqual([1, 2, 255, 3, 4, 5]);
    });

    it("reads unsynchronised content with data length indicator", async () => {
      const id3FileContents =
        new ID3v2TagContents(4, 3)
          .addFrame("TIT2", [].concat(
            // @ts-expect-error
            [0x00], // encoding
            bin("The title"), [0x00]
          ))
          .addFrame("APIC", [].concat(
            // @ts-expect-error
            [0x00], // text encoding
            bin("image/jpeg"), [0x00],
            [0x03], // picture type - cover front
            bin("front cover image"), [0x00],
            [0x01, 0x02, 0xff, 0x00, 0x03, 0x04, 0x05] // image data
          ), {
            // @ts-ignore
            format: {
              unsynchronisation: true,
              data_length_indicator: true,
            },
          }, 37);
      mediaFileReader = new ArrayFileReader(id3FileContents.toArray());
      tagReader = new ID3v2TagReader(mediaFileReader);

      const tags = await tagReader.read();
      expect(tags.tags.title).toBe("The title");
      expect(tags.tags.picture!.data).toEqual([1, 2, 255, 3, 4, 5]);
    });

    it("doesn't unsynchronise frames twice", async () => {
      const id3FileContents =
        new ID3v2TagContents(4, 3)
        // @ts-ignore
          .setFlags({
            unsynchronisation: true
          })
          .addFrame("TIT2", [].concat(
            // @ts-expect-error
            [0x00], // encoding
            bin("The title"), [0x00]
          ))
          .addFrame("APIC", [].concat(
            // @ts-expect-error
            [0x00], // text encoding
            bin("image/jpeg"), [0x00],
            [0x03], // picture type - cover front
            bin("front cover image"), [0x00],
            [0x01, 0x02, 0xff, 0x00, 0x00, 0x03, 0x04, 0x05] // image data
          ), {
            // @ts-ignore
            format: {
              unsynchronisation: true
            }
          });
      mediaFileReader = new ArrayFileReader(id3FileContents.toArray());
      tagReader = new ID3v2TagReader(mediaFileReader);

      const tags = await tagReader.read();
      expect(tags.tags.picture!.data).toEqual([1, 2, 255, 0, 3, 4, 5]);
    });
  });

  it("should process frames with no content", async () => {
    const id3FileContents =
      new ID3v2TagContents(4, 3)
      // @ts-ignore
        .addFrame("WOAF") // empty frame contents
        .addFrame("TIT2", [].concat(
          // @ts-expect-error
          [0x00], // encoding
          bin("The title"), [0x00]
        ));
    mediaFileReader = new ArrayFileReader(id3FileContents.toArray());
    tagReader = new ID3v2TagReader(mediaFileReader);

    const tags = await tagReader.read();
    expect("TIT2" in tags.tags).toBeTruthy();
  });

  it("should correctly assign shortcuts to when there are multiple instances of the same frame", async () => {
    const id3FileContents =
      new ID3v2TagContents(4, 3)
        .addFrame("TIT2", [].concat(
          // @ts-expect-error
          [0x00], // encoding
          bin("The title"), [0x00]
        ))
        .addFrame("TIT2", [].concat(
          // @ts-expect-error
          [0x00], // text encoding
          bin("Another title"), [0x00]
        ));
    mediaFileReader = new ArrayFileReader(id3FileContents.toArray());
    tagReader = new ID3v2TagReader(mediaFileReader);

    const tags = await tagReader.read();
    expect(tags.tags.title).toBe("The title");
  });
});