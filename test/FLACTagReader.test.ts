import ArrayFileReader from "../src/ArrayFileReader.js";
import FLACTagContents from "../src/FLACTagContents.js";
import FLACTagReader from "../src/FLACTagReader.js";

jest.autoMockOff();

describe("FLACTagReader", () => {
  const flacFileContents = new FLACTagContents([FLACTagContents.createCommentBlock(
    ["TITLE", "A Title"],
    ["ARTIST", "An Artist"],
    ["ALBUM", "An Album"],
    ["TRACKNUMBER", "1"],
    ["GENRE", "A Genre"]
  ), FLACTagContents.createPictureBlock()]);
  let mediaFileReader: ArrayFileReader;
  let tagReader: FLACTagReader;

  beforeEach(() => {
    mediaFileReader = new ArrayFileReader(flacFileContents.toArray());
    tagReader = new FLACTagReader(mediaFileReader);
  });

  it("reads the tag type", async () => {
    const tag = await new Promise<any>((resolve, reject) => {
      tagReader.read({
        onSuccess: resolve,
        // @ts-expect-error
        onFailure: reject
      });
      jest.runAllTimers();
    });
    expect(tag.type).toBe("FLAC");
    expect(tag.version).toBe("1");
  });

  it("reads a string tag", async () => {
    const tag = await new Promise<any>((resolve, reject) => {
      tagReader.read({
        onSuccess: resolve,
        // @ts-expect-error
        onFailure: reject
      });
      jest.runAllTimers();
    });
    const tags = tag.tags;
    expect(tags.title).toBe("A Title");
  });

  it("reads an image tag", async () => {
    const tag = await new Promise<any>((resolve, reject) => {
      tagReader.read({
        onSuccess: resolve,
        // @ts-expect-error
        onFailure: reject
      });
      jest.runAllTimers();
    });
    const tags = tag.tags;
    expect(tags.picture.description).toBe("A Picture");
  });

  it("reads all tags", async () => {
    const tag = await new Promise<any>((resolve, reject) => {
      tagReader.read({
        onSuccess: resolve,
        // @ts-expect-error
        onFailure: reject
      });
      jest.runAllTimers();
    });
    const tags = tag.tags;
    expect(tags.title).toBeTruthy();
    expect(tags.artist).toBeTruthy();
    expect(tags.album).toBeTruthy();
    expect(tags.track).toBeTruthy();
    expect(tags.picture).toBeTruthy();
  });

  it("reads tags no matter their case", async () => {
    const flacFileContents = new FLACTagContents([FLACTagContents.createCommentBlock(
      ["Title", "A Title"],
      ["artist", "An Artist"],
    )]);
    mediaFileReader = new ArrayFileReader(flacFileContents.toArray());
    tagReader = new FLACTagReader(mediaFileReader);
    const tag = await new Promise<any>((resolve, reject) => {
      tagReader.read({
        onSuccess: resolve,
        // @ts-expect-error
        onFailure: reject
      });
      jest.runAllTimers();
    });
    const tags = tag.tags;
    expect(tags.title).toBeTruthy();
    expect(tags.artist).toBeTruthy();
  });

  it("calls failure callback if file doesn't have comments", async () => {
    const flacFileEmpty = new FLACTagContents();
    const fileReaderEmpty = new ArrayFileReader(flacFileEmpty.toArray());
    const tagReaderEmpty = new FLACTagReader(fileReaderEmpty);
    try {
      return await new Promise<any>((resolve, reject) => {
        tagReaderEmpty.read({
          onSuccess: resolve,
          onError: reject
        });
        jest.runAllTimers();
      });
    } catch (error: any) {
      expect(error.type).toBe("loadData");
    }
  });
});
