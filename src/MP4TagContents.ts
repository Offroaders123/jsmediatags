/**
 * This is only used for testing, but could be used for other purposes as
 * writing.
 *
 * http://atomicparsley.sourceforge.net/mpeg-4files.html
 */

import { bin, pad, getInteger32 } from "./ByteArrayUtils.js";

import type { ByteArray } from "./FlowTypes.js";

export default class MP4TagContents {
  declare _atoms: Atom[];

  constructor(ftyp: string, atoms?: Atom | Atom[]) {
    this._atoms = [
      new Atom("ftyp", pad(bin(ftyp), 24))
    ].concat(atoms || []);
  }

  toArray(): ByteArray {
    return this._atoms.reduce(function(array, atom) {
      // @ts-expect-error
      return array.concat(atom.toArray());
    }, []);
  }

  static createAtom(atomName: string): Atom {
    return new Atom(atomName);
  }

  static createContainerAtom(atomName: string, atoms: Atom[], data?: ByteArray): Atom {
    return new Atom(atomName, data, atoms);
  }

  static createMetadataAtom(atomName: string, type: string, data: ByteArray): Atom {
    const klass = {
      uint8: 0,
      uint8b: 21, // Apple changed from 21 to 0 in latest versions
      text: 1,
      jpeg: 13,
      png: 14,
    }[type];

    return this.createContainerAtom(atomName, [
      // @ts-expect-error
      new Atom("data", [].concat(
        [0x00, 0x00, 0x00, klass], // 1 byte atom version + 3 byte atom flags
        [0x00, 0x00, 0x00, 0x00], // NULL space
        data
      ))
    ]);
  }
}

class Atom {
  declare _name: string;
  declare _data: number[];
  declare _atoms: Atom[];

  constructor(name: string, data?: ByteArray | null, atoms?: Atom[] | null) {
    this._name = name;
    this._data = data || [];
    this._atoms = atoms || [];
  }

  toArray(): ByteArray {
    const atomsArray = this._atoms.reduce(function(array, atom) {
      // @ts-expect-error
      return array.concat(atom.toArray());
    }, []);
    const length = 4 + this._name.length + this._data.length + atomsArray.length;

    return [].concat(
      // @ts-expect-error
      getInteger32(length),
      bin(this._name),
      this._data,
      atomsArray
    );
  }
}

export type { Atom };