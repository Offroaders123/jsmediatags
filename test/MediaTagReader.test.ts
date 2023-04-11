import MediaTagReader from "../src/MediaTagReader.js";
import MediaFileReader from "../src/MediaFileReader.js";

jest
  .dontMock("../src/MediaTagReader.js");

describe("MediaTagReader", () => {
  let mediaTagReader: MediaTagReader;
  let mediaFileReader: MediaFileReader;

  beforeEach(() => {
    mediaFileReader = new MediaFileReader();
    mediaFileReader.init =
      jest.fn().mockImplementation(callbacks => {
        setTimeout(() => {
          callbacks.onSuccess();
        }, 1);
      });
    mediaTagReader = new MediaTagReader(mediaFileReader);
  });

  it("can read the data given by _parseData", async () => {
    const expectedTags = {};
    mediaTagReader._loadData =
      jest.fn().mockImplementation((_, callbacks) => {
        setTimeout(() => {
          callbacks.onSuccess();
        }, 1);
      });
    mediaTagReader._parseData =
      jest.fn().mockImplementation(() => {
        return expectedTags;
      });

    const tags = await new Promise((resolve, reject) => {
      mediaTagReader.read({ onSuccess: resolve, onError: reject });
      jest.runAllTimers();
    });
    expect(tags).toBe(expectedTags);
  });

  it("should _loadData when it needs to be read", async () => {
    mediaTagReader._loadData = jest.fn().mockImplementation(
      (localMediaFileReader, callbacks) => {
        expect(localMediaFileReader).toBe(mediaFileReader);
        setTimeout(() => {
          callbacks.onSuccess();
        }, 1);
      }
    );
    mediaTagReader._parseData = jest.fn();

    const tags = await new Promise((resolve, reject) => {
      mediaTagReader.read({ onSuccess: resolve, onError: reject });
      jest.runAllTimers();
    });
    expect(mediaTagReader._loadData).toBeCalled();
  });
});
