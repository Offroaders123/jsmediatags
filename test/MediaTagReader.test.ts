import MediaTagReader from '../src/MediaTagReader.js';
import MediaFileReader from '../src/MediaFileReader.js';

jest
  .dontMock('../src/MediaTagReader.js');

describe("MediaTagReader", function() {
  var mediaTagReader: MediaTagReader;
  var mediaFileReader: MediaFileReader;

  beforeEach(function() {
    mediaFileReader = new MediaFileReader();
    mediaFileReader.init =
      jest.fn().mockImplementation(function(callbacks) {
        setTimeout(function() {
          callbacks.onSuccess();
        }, 1);
      });
    mediaTagReader = new MediaTagReader(mediaFileReader);
  });

  it("can read the data given by _parseData", async function() {
    var expectedTags = {};
    mediaTagReader._loadData =
      jest.fn().mockImplementation(function(_, callbacks) {
        setTimeout(function() {
          callbacks.onSuccess();
        }, 1);
      });
    mediaTagReader._parseData =
      jest.fn().mockImplementation(function() {
        return expectedTags;
      });

    const tags = await new Promise(function (resolve, reject) {
      mediaTagReader.read({ onSuccess: resolve, onError: reject });
      jest.runAllTimers();
    });
    expect(tags).toBe(expectedTags);
  });

  it("should _loadData when it needs to be read", async function() {
    mediaTagReader._loadData = jest.fn().mockImplementation(
      function(localMediaFileReader, callbacks) {
        expect(localMediaFileReader).toBe(mediaFileReader);
        setTimeout(function() {
          callbacks.onSuccess();
        }, 1);
      }
    );
    mediaTagReader._parseData = jest.fn();

    const tags = await new Promise(function (resolve, reject) {
      mediaTagReader.read({ onSuccess: resolve, onError: reject });
      jest.runAllTimers();
    });
    expect(mediaTagReader._loadData).toBeCalled();
  });
});
