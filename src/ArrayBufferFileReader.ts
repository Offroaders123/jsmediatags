/**
 * @flow
 */
'use strict';

import ChunkedFileData = require('./ChunkedFileData');
import MediaFileReader = require('./MediaFileReader');

import type {
    LoadCallbackType
} from './FlowTypes';

class ArrayBufferFileReader extends MediaFileReader {
    _buffer: ArrayBuffer;
    _fileData: ChunkedFileData;

    constructor(buffer: ArrayBuffer) {
        super();
        this._buffer = buffer;
        this._fileData = new ChunkedFileData();
    }

    static override canReadFile(file: any): boolean {
        return typeof ArrayBuffer === 'function' && file instanceof ArrayBuffer
    }

    override _init(callbacks: LoadCallbackType): void {
        this._size = this._buffer.byteLength;
        setTimeout(callbacks.onSuccess, 1);
    }

    override loadRange(range: [number, number], callbacks: LoadCallbackType): void {
        var arrayBuf = this._buffer.slice(range[0], range[1] + 1);
        var viewData = new Uint8Array(arrayBuf);
        this._fileData.addData(range[0], viewData);
        callbacks.onSuccess();
    }

    override getByteAt(offset: number): number {
        return this._fileData.getByteAt(offset);
    }
}

export = ArrayBufferFileReader;
