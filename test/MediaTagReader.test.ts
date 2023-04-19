import { jest, describe, beforeEach, it, expect } from "@jest/globals";

import MediaTagReader from "../src/MediaTagReader.js";
import MediaFileReader from "../src/MediaFileReader.js";

import type { TagType } from "../src/FlowTypes.js";

jest
  .dontMock("../src/MediaTagReader.js")
  .useRealTimers();

describe("MediaTagReader", () => {
  let mediaTagReader: MediaTagReader;
  let mediaFileReader: MediaFileReader;

  beforeEach(() => {
    mediaFileReader = new MediaFileReader();
    mediaFileReader.init =
      jest.fn<typeof mediaFileReader.init>().mockImplementation(async () => {
        return new Promise(resolve => setTimeout(resolve, 1));
      });
    mediaTagReader = new MediaTagReader(mediaFileReader);
  });

  it("can read the data given by _parseData", async () => {
    const expectedTags = {} as TagType;
    mediaTagReader._loadData =
      jest.fn<typeof mediaTagReader._loadData>().mockImplementation(async _ => {
        return new Promise(resolve => setTimeout(resolve, 1));
      });
    mediaTagReader._parseData =
      jest.fn<typeof mediaTagReader._parseData>().mockImplementation(() => {
        return expectedTags;
      });

    const tags = await mediaTagReader.read();
    expect(tags).toBe(expectedTags);
  });

  it("should _loadData when it needs to be read", async () => {
    mediaTagReader._loadData = jest.fn<typeof mediaTagReader._loadData>().mockImplementation(
      async localMediaFileReader => {
        expect(localMediaFileReader).toBe(mediaFileReader);
        return new Promise(resolve => setTimeout(resolve, 1));
      }
    );
    mediaTagReader._parseData = jest.fn<typeof mediaTagReader._parseData>();

    await mediaTagReader.read();

    expect(mediaTagReader._loadData).toBeCalled();
  });
});