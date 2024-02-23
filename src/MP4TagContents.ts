/**
 * This is only used for testing, but could be used for other purposes as
 * writing.
 *
 * http://atomicparsley.sourceforge.net/mpeg-4files.html
 *
 * @flow
 */
'use strict';

import {
  bin,
  pad,
  getInteger32
} from './ByteArrayUtils';

import type {
  ByteArray
} from './FlowTypes';

class MP4TagContents {
  private _atoms: Array<Atom>;

  constructor(ftyp: string, atoms?: Array<Atom>) {
    this._atoms = [
      new Atom("ftyp", pad(bin(ftyp), 24))
    ].concat(atoms || []);
  }

  toArray(): ByteArray {
    return this._atoms.reduce(function(array, atom) {
      return array.concat(atom.toArray());
    }, [] as ByteArray);
  }

  static createAtom(atomName: string): Atom {
    return new Atom(atomName);
  }

  static createContainerAtom(atomName: string, atoms: Array<Atom>, data?: ByteArray): Atom {
    return new Atom(atomName, data, atoms);
  }

  static createMetadataAtom(atomName: string, type: string, data: ByteArray): Atom {
    var klass: number = {
      "uint8": 0,
      "uint8b": 21, // Apple changed from 21 to 0 in latest versions
      "text": 1,
      "jpeg": 13,
      "png": 14,
    }[type]!;

    return this.createContainerAtom(atomName, [
      new Atom("data", ([] as ByteArray).concat(
        [0x00, 0x00, 0x00, klass], // 1 byte atom version + 3 byte atom flags
        [0x00, 0x00, 0x00, 0x00], // NULL space
        data
      ))
    ]);
  }
}

class Atom {
  private _name: string;
  private _data: Array<number>;
  private _atoms: Array<Atom>;

  constructor(name: string, data?: ByteArray, atoms?: Array<Atom>) {
    this._name = name;
    this._data = data || [];
    this._atoms = atoms || [];
  }

  toArray(): ByteArray {
    var atomsArray = this._atoms.reduce(function(array, atom) {
      return array.concat(atom.toArray());
    }, [] as ByteArray);
    var length = 4 + this._name.length + this._data.length + atomsArray.length;

    return ([] as ByteArray).concat(
      getInteger32(length),
      bin(this._name),
      this._data,
      atomsArray
    );
  }
}

export = MP4TagContents;
