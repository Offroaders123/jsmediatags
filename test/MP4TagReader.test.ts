import MP4TagReader from '../src/MP4TagReader.js';
import MP4TagContents, { type Atom } from '../src/MP4TagContents.js';
import ArrayFileReader from '../src/ArrayFileReader.js';

import { bin, pad } from '../src/ByteArrayUtils.js';

jest.autoMockOff();

function createMP4FileContents(atoms: Atom[]) {
  return new MP4TagContents(
    "M4A ",
    MP4TagContents.createContainerAtom("moov", [
      MP4TagContents.createAtom("mvhd"),
      MP4TagContents.createAtom("trak"),
      MP4TagContents.createContainerAtom("udta", [
        MP4TagContents.createContainerAtom("meta", [
          MP4TagContents.createAtom("hdlr"),
          MP4TagContents.createContainerAtom("ilst", atoms)
        ], [0x00, 0x00, 0x00, 0x01])
      ])
    ])
  );
}

describe("MP4TagReader", function() {
  var tagReader: MP4TagReader;
  var mediaFileReader: ArrayFileReader;
  var mp4FileContents = createMP4FileContents([
    MP4TagContents.createMetadataAtom("©nam", "text", bin("A Title")),
    MP4TagContents.createMetadataAtom("©ART", "text", bin("A Artist")),
    MP4TagContents.createMetadataAtom("©alb", "text", bin("A Album")),
    // @ts-expect-error
    MP4TagContents.createMetadataAtom("trkn", "uint8", [].concat(
      [0x00, 0x00, 0x00, 0x02], // track
      [0x00, 0x00, 0x00, 0x09] // total track count
    )),
    // @ts-expect-error
    MP4TagContents.createMetadataAtom("disk", "uint8", [].concat(
      [0x00, 0x00, 0x00, 0x02], // disk
      [0x00, 0x00, 0x00, 0x03] // total disk count
    )),
    MP4TagContents.createMetadataAtom("©cmt", "text", bin("A Comment")),
    MP4TagContents.createMetadataAtom("cpil", "uint8", [0x01]),
    MP4TagContents.createMetadataAtom("covr", "jpeg", [0x01, 0x02, 0x03])
  ]);

  beforeEach(function() {
    mediaFileReader = new ArrayFileReader(mp4FileContents.toArray());
    tagReader = new MP4TagReader(mediaFileReader);
  });

  it("can read any ftyp type", function() {
    var canReadM4A = MP4TagReader.canReadTagFormat([0x0, 0x0, 0x0, 0x0].concat(bin("ftypM4A ")));
    var canReadISOM = MP4TagReader.canReadTagFormat([0x0, 0x0, 0x0, 0x0].concat(bin("ftypisom")));

    expect(canReadM4A).toBeTruthy();
    expect(canReadISOM).toBeTruthy();
  });

  it("reads the type and version", async function() {
    const tag = await new Promise<any>(function (resolve, reject) {
      tagReader.read({
        onSuccess: resolve,
        // @ts-expect-error
        onFailure: reject
      });
      jest.runAllTimers();
    });
    expect(tag.type).toBe("MP4");
    expect(tag.ftyp).toBe("M4A ");
  });

  it("reads string tag", async function() {
    const tag = await new Promise<any>(function (resolve, reject) {
      tagReader.read({
        onSuccess: resolve,
        // @ts-expect-error
        onFailure: reject
      });
      jest.runAllTimers();
    });
    var tags = tag.tags;
    expect(tags['©nam'].data).toBe("A Title");
  });

  it("reads uint8 tag", async function() {
    const tag = await new Promise<any>(function (resolve, reject) {
      tagReader.read({
        onSuccess: resolve,
        // @ts-expect-error
        onFailure: reject
      });
      jest.runAllTimers();
    });
    var tags = tag.tags;
    expect(tags.cpil.data).toBeTruthy();
  });

  it("reads jpeg tag", async function() {
    const tag = await new Promise<any>(function (resolve, reject) {
      tagReader.read({
        onSuccess: resolve,
        // @ts-expect-error
        onFailure: reject
      });
      jest.runAllTimers();
    });
    var tags = tag.tags;
    expect("covr" in tags).toBeTruthy();
    expect(tags.covr.data.format).toBe("image/jpeg");
    expect(tags.covr.data.data).toEqual([1, 2, 3]);
  });

  it("reads multiple int tags", async function() {
    const tag = await new Promise<any>(function (resolve, reject) {
      tagReader.read({
        onSuccess: resolve,
        // @ts-expect-error
        onFailure: reject
      });
      jest.runAllTimers();
    });
    var tags = tag.tags;
    expect(tags.trkn.data.track).toBe(2);
    expect(tags.trkn.data.total).toBe(9);
    expect(tags.disk.data.disk).toBe(2);
    expect(tags.disk.data.total).toBe(3);
  });

  it("reads all tags", async function() {
    const tag = await new Promise<any>(function (resolve, reject) {
      tagReader.read({
        onSuccess: resolve,
        // @ts-expect-error
        onFailure: reject
      });
      jest.runAllTimers();
    });
    var tags = tag.tags;
    expect("©nam" in tags).toBeTruthy();
    expect("©ART" in tags).toBeTruthy();
    expect("©alb" in tags).toBeTruthy();
    expect("trkn" in tags).toBeTruthy();
    expect("©cmt" in tags).toBeTruthy();
    expect("cpil" in tags).toBeTruthy();
    expect("covr" in tags).toBeTruthy();
  });

  it("creates shorcuts", async function() {
    const tag = await new Promise<any>(function (resolve, reject) {
      tagReader.read({
        onSuccess: resolve,
        // @ts-expect-error
        onFailure: reject
      });
      jest.runAllTimers();
    });
    var tags = tag.tags;
    expect("artist" in tags).toBeTruthy();
    expect(tags.artist).toBe(tags["©ART"].data);
  });

  it("reads the specificed tag", async function() {
    const tag = await new Promise<any>(function (resolve, reject) {
      tagReader.setTagsToRead(["©cmt"])
        .read({
          onSuccess: resolve,
          // @ts-expect-error
          onFailure: reject
        });
      jest.runAllTimers();
    });
    expect(Object.keys(tag.tags)).not.toContain("©nam");
    expect(Object.keys(tag.tags)).toContain("©cmt");
  });

  it("reads the specificed shortcut tag", async function() {
    const tag = await new Promise<any>(function (resolve, reject) {
      tagReader.setTagsToRead(["title"])
        .read({
          onSuccess: resolve,
          // @ts-expect-error
          onFailure: reject
        });
      jest.runAllTimers();
    });
    expect(Object.keys(tag.tags)).toContain("title");
  });

  it("reads jpeg tag despite uint8 type", async function() {
    var mp4FileContents = createMP4FileContents([
      MP4TagContents.createMetadataAtom("covr", "uint8", [0x01, 0x02, 0x03])
    ]);
    var mediaFileReader = new ArrayFileReader(mp4FileContents.toArray());
    var tagReader = new MP4TagReader(mediaFileReader);

    const tag = await new Promise<any>(function (resolve, reject) {
      tagReader.read({
        onSuccess: resolve,
        // @ts-expect-error
        onFailure: reject
      });
      jest.runAllTimers();
    });
    var tags = tag.tags;
    expect("covr" in tags).toBeTruthy();
    expect(tags.covr.data.format).toBe("image/jpeg");
    expect(tags.covr.data.data).toEqual([1, 2, 3]);
  });
});