import { jest } from "@jest/globals";

import MediaTagReader from "../src/MediaTagReader.js";
import MediaFileReader from "../src/MediaFileReader.js";

import type { TagType } from "../src/FlowTypes.js";

jest
  .dontMock("../src/MediaTagReader.js");

describe("MediaTagReader", () => {
  let mediaTagReader: MediaTagReader;
  let mediaFileReader: MediaFileReader;

  beforeEach(() => {
    mediaFileReader = new MediaFileReader();
    mediaFileReader.init =
      jest.fn<typeof mediaFileReader.init>().mockImplementation(callbacks => {
        setTimeout(() => {
          callbacks.onSuccess();
        }, 1);
      });
    mediaTagReader = new MediaTagReader(mediaFileReader);
  });

  it("can read the data given by _parseData", async () => {
    const expectedTags = {} as TagType;
    mediaTagReader._loadData =
      jest.fn<typeof mediaTagReader._loadData>().mockImplementation((_, callbacks) => {
        setTimeout(() => {
          callbacks.onSuccess();
        }, 1);
      });
    mediaTagReader._parseData =
      jest.fn<typeof mediaTagReader._parseData>().mockImplementation(() => {
        return expectedTags;
      });

    const tags = await new Promise((resolve, reject) => {
      mediaTagReader.read({ onSuccess: resolve, onError: reject });
      jest.runAllTimers();
    });
    expect(tags).toBe(expectedTags);
  });

  it("should _loadData when it needs to be read", async () => {
    mediaTagReader._loadData = jest.fn<typeof mediaTagReader._loadData>().mockImplementation(
      (localMediaFileReader, callbacks) => {
        expect(localMediaFileReader).toBe(mediaFileReader);
        setTimeout(() => {
          callbacks.onSuccess();
        }, 1);
      }
    );
    mediaTagReader._parseData = jest.fn<typeof mediaTagReader._parseData>();

    const tags = await new Promise((resolve, reject) => {
      mediaTagReader.read({ onSuccess: resolve, onError: reject });
      jest.runAllTimers();
    });
    expect(mediaTagReader._loadData).toBeCalled();
  });
});
