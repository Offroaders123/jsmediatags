import { jest, describe, it, expect } from "@jest/globals";

import ID3v1TagReader from "../src/ID3v1TagReader.js";
import ArrayFileReader from "../src/ArrayFileReader.js";

import { bin } from "../src/ByteArrayUtils.js";
import { pad } from "../src/ByteArrayUtils.js";

import type { ByteArray } from "../src/FlowTypes.js";

jest
  .autoMockOff()
  .useRealTimers();

describe("ID3v1TagReader", () => {
  it("reads 1.0 tags", async () => {
    const id3ArrayFile: ByteArray = [
      ...bin("TAG"),
      ...pad(bin("Song Title"), 30) as ByteArray,
      ...pad(bin("The Artist"), 30) as ByteArray,
      ...pad(bin("The Album"), 30) as ByteArray,
      ...bin("1995"),
      ...pad(bin("A Comment"), 30) as ByteArray,
      30
    ];
    const mediaFileReader = new ArrayFileReader(id3ArrayFile);
    const tagReader = new ID3v1TagReader(mediaFileReader);

    const tags = await tagReader.read();

    expect(tags).toEqual({
      type: "ID3",
      version: "1.0",
      tags: {
        title: "Song Title",
        artist: "The Artist",
        album: "The Album",
        year: "1995",
        comment: "A Comment",
        genre: "Fusion"
      }
    });
  });

  it("reads 1.1 tags", async () => {
    const id3ArrayFile: ByteArray = [
      ...bin("TAG"),
      ...pad(bin("Song Title"), 30) as ByteArray,
      ...pad(bin("The Artist"), 30) as ByteArray,
      ...pad(bin("The Album"), 30) as ByteArray,
      ...bin("1995"),
      ...pad(bin("A Comment"), 29) as ByteArray,
      3,
      30
    ];
    const mediaFileReader = new ArrayFileReader(id3ArrayFile);
    const tagReader = new ID3v1TagReader(mediaFileReader);

    const tags = await tagReader.read();

    expect(tags).toEqual({
      type: "ID3",
      version: "1.1",
      tags: {
        title: "Song Title",
        artist: "The Artist",
        album: "The Album",
        year: "1995",
        comment: "A Comment",
        track: 3,
        genre: "Fusion"
      }
    });
  });
});