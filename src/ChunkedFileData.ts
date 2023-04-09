import type { ChunkType, DataType, TypedArray } from "./FlowTypes.js";

const NOT_FOUND = -1;

/**
 * This class represents a file that might not have all its data loaded yet.
 * It is used when loading the entire file is not an option because it's too
 * expensive. Instead, parts of the file are loaded and added only when needed.
 * From a reading point of view is as if the entire file is loaded. The
 * exception is when the data is not available yet, an error will be thrown.
 * This class does not load the data, it just manages it. It provides operations
 * to add and read data from the file.
 */
export default class ChunkedFileData {
  static get NOT_FOUND() { return NOT_FOUND; }
  declare _fileData: ChunkType[];

  constructor() {
    this._fileData = [];
  }

  /**
   * Adds data to the file storage at a specific offset.
   */
  addData(offset: number, data: DataType): void {
    const offsetEnd = offset+data.length-1;
    const chunkRange = this._getChunkRange(offset, offsetEnd);

    if (chunkRange.startIx === NOT_FOUND) {
      this._fileData.splice(chunkRange.insertIx || 0, 0, {
        offset: offset,
        data: data
      });
    } else {
      // If the data to add collides with existing chunks we prepend and
      // append data from the half colliding chunks to make the collision at
      // 100%. The new data can then replace all the colliding chunkes.
      const firstChunk = this._fileData[chunkRange.startIx];
      const lastChunk = this._fileData[chunkRange.endIx];
      const needsPrepend = offset > firstChunk.offset;
      const needsAppend = offsetEnd < lastChunk.offset + lastChunk.data.length - 1;

      const chunk = {
        offset: Math.min(offset, firstChunk.offset),
        data: data
      };

      if (needsPrepend) {
        var slicedData = this._sliceData(
          firstChunk.data,
          0,
          offset - firstChunk.offset
        );
        chunk.data = this._concatData(slicedData, data);
      }

      if (needsAppend) {
        // Use the lastChunk because the slice logic is easier to handle.
        var slicedData = this._sliceData(
          chunk.data,
          0,
          lastChunk.offset - chunk.offset
        );
        chunk.data = this._concatData(slicedData, lastChunk.data);
      }

      this._fileData.splice(
        chunkRange.startIx,
        chunkRange.endIx - chunkRange.startIx + 1,
        chunk
      );
    }
  }

  _concatData(dataA: DataType, dataB: DataType): DataType {
    // TypedArrays don't support concat.
    if (
      typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView &&
      ArrayBuffer.isView(dataA)
    ) {
      // @ts-expect-error - flow thinks dataAandB is a string but it's not
      const dataAandB = new (dataA.constructor as TypedArray)(dataA.length + dataB.length);
      dataAandB.set(dataA, 0);
      dataAandB.set(dataB, dataA.length);
      return dataAandB;
    } else {
      // @ts-expect-error - flow thinks dataAandB is a TypedArray but it's not
      return dataA.concat(dataB);
    }
  }

  _sliceData(data: DataType, begin: number, end: number): DataType {
    // Some TypeArray implementations do not support slice yet.
    if (data.slice) {
      return data.slice(begin, end);
    } else {
      // $FlowIssue - flow thinks data is a string but it's not
      return (data as TypedArray).subarray(begin, end);
    }
  }

  /**
   * Finds the chunk range that overlaps the [offsetStart-1,offsetEnd+1] range.
   * When a chunk is adjacent to the offset we still consider it part of the
   * range (this is the situation of offsetStart-1 or offsetEnd+1).
   * When no chunks are found `insertIx` denotes the index where the data
   * should be inserted in the data list (startIx == NOT_FOUND and endIX ==
   * NOT_FOUND).
   */
  _getChunkRange(
    offsetStart: number,
    offsetEnd: number
  ): {startIx: number, endIx: number, insertIx?: number} {
    let startChunkIx = NOT_FOUND;
    let endChunkIx = NOT_FOUND;
    let insertIx = 0;

    // Could use binary search but not expecting that many blocks to exist.
    for (let i = 0; i < this._fileData.length; i++, insertIx = i) {
      const chunkOffsetStart = this._fileData[i].offset;
      const chunkOffsetEnd = chunkOffsetStart + this._fileData[i].data.length;

      if (offsetEnd < chunkOffsetStart-1) {
        // This offset range doesn't overlap with any chunks.
        break;
      }
      // If it is adjacent we still consider it part of the range because
      // we're going end up with a single block with all contiguous data.
      if (offsetStart <= chunkOffsetEnd+1 &&
          offsetEnd >= chunkOffsetStart-1) {
        startChunkIx = i;
        break;
      }
    }

    // No starting chunk was found, meaning that the offset is either before
    // or after the current stored chunks.
    if (startChunkIx === NOT_FOUND) {
      return {
        startIx: NOT_FOUND,
        endIx: NOT_FOUND,
        insertIx: insertIx
      };
    }

    // Find the ending chunk.
    for (let i = startChunkIx; i < this._fileData.length; i++) {
      const chunkOffsetStart = this._fileData[i].offset;
      const chunkOffsetEnd = chunkOffsetStart + this._fileData[i].data.length;

      if (offsetEnd >= chunkOffsetStart-1) {
        // Candidate for the end chunk, it doesn't mean it is yet.
        endChunkIx = i;
      }
      if (offsetEnd <= chunkOffsetEnd+1) {
        break;
      }
    }

    if (endChunkIx === NOT_FOUND) {
      endChunkIx = startChunkIx;
    }

    return {
      startIx: startChunkIx,
      endIx: endChunkIx
    };
  }

  hasDataRange(offsetStart: number, offsetEnd: number): boolean {
    for (let i = 0; i < this._fileData.length; i++) {
      const chunk = this._fileData[i];
      if (offsetEnd < chunk.offset) {
        return false;
      }

      if (offsetStart >= chunk.offset &&
          offsetEnd < chunk.offset + chunk.data.length) {
        return true;
      }
    }

    return false;
  }

  getByteAt(offset: number): any {
    let dataChunk;

    for (let i = 0; i < this._fileData.length; i++) {
      const dataChunkStart = this._fileData[i].offset;
      const dataChunkEnd = dataChunkStart + this._fileData[i].data.length - 1;

      if (offset >= dataChunkStart && offset <= dataChunkEnd) {
        dataChunk = this._fileData[i];
        break;
      }
    }

    if (dataChunk) {
      return dataChunk.data[offset - dataChunk.offset];
    }

    throw new Error("Offset " + offset + " hasn't been loaded yet.");
  }
}