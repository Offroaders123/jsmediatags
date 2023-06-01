import ChunkedFileData from "./ChunkedFileData.js";
import MediaFileReader from "./MediaFileReader.js";

export default class BlobFileReader extends MediaFileReader {
  declare private _blob: Blob;
  declare private _fileData: ChunkedFileData;

  constructor(blob: Blob) {
    super();
    this._blob = blob;
    this._fileData = new ChunkedFileData();
  }

  static override canReadFile(file: any): boolean {
    return (
      (typeof Blob !== "undefined" && file instanceof Blob) ||
      // File extends Blob but it seems that File instanceof Blob doesn't
      // quite work as expected in Cordova/PhoneGap.
      (typeof File !== "undefined" && file instanceof File)
    );
  }

  protected override async _init(): Promise<void> {
    this._size = this._blob.size;
    await new Promise(resolve => setTimeout(resolve, 1));
  }

  override async loadRange(range: [number, number]): Promise<void> {
    const blob = this._blob.slice(range[0], range[1] + 1);
    let buffer: ArrayBuffer;

    try {
      buffer = await blob.arrayBuffer();
    } catch (error: any){
      throw new Error(`blob: ${error.message}`);
    }

    const intArray = new Uint8Array(buffer);
    this._fileData.addData(range[0],intArray);
  }

  override getByteAt(offset: number): number {
    return this._fileData.getByteAt(offset);
  }
}