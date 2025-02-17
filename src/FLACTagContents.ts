import { bin } from './ByteArrayUtils';
import { getInteger24 } from './ByteArrayUtils';
import { getInteger32 } from './ByteArrayUtils';

import type {
  ByteArray
} from './FlowTypes';

class FLACTagContents {
  private _blocks: Array<MetadataBlock>;

  constructor(blocks?: Array<MetadataBlock>) {
    this._blocks = [];
    this._blocks.push(FLACTagContents.createStreamBlock());
    this._blocks = this._blocks.concat(blocks || []);
  }

  toArray(): ByteArray {
    this._blocks[this._blocks.length - 1]!.setFinal();
    return this._blocks.reduce(function(array, block) {
      return array.concat(block.toArray());
    }, bin("fLaC"));
  }

  static createBlock(type: number, data: ByteArray): MetadataBlock {
    return new MetadataBlock(type, data);
  }

  static createStreamBlock(): MetadataBlock {
    let data = [0x00, 0x00, 0x22].concat(Array(34).fill(0x00));
    return this.createBlock(0, data);
  }

  static createCommentBlock(...data: Array<Array<string>>): MetadataBlock {
    let length = 12;
    let byteArray: ByteArray = [];
    for (let i = 0; i < data.length; i++) {
      length += data[i]![0]!.length + data[i]![1]!.length + 5;
      byteArray = byteArray.concat(getInteger32(data[i]![0]!.length + data[i]![1]!.length + 1).reverse());
      let entry = data[i]![0]! + "=" + data[i]![1]!;
      byteArray = byteArray.concat(bin(entry));
    }
    let array = ([] as ByteArray).concat(getInteger24(length), [0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
      getInteger32(data.length).reverse(), byteArray);
    return this.createBlock(4, array);
  }

  static createPictureBlock() {
    let data = ([] as ByteArray).concat(getInteger24(45), getInteger32(3), getInteger32(10),
      bin("image/jpeg"), getInteger32(9), bin("A Picture"), Array(16).fill(0x00),
      getInteger32(4), bin("data"));
    return this.createBlock(6, data);
  }
}

class MetadataBlock {
  private _data: Array<number>;
  private _final: boolean;
  private _type: number;

  constructor(type: number, data: ByteArray) {
    this._type = type;
    this._data = data;
    this._final = false;
  }

  setFinal(): void {
    this._final = true;
  }

  toArray(): ByteArray {
    return [ this._type + (this._final ? 128 : 0) ].concat(this._data);
  }
}

export = FLACTagContents;
