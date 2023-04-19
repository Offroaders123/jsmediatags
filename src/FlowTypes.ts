import type MediaFileReader from "./MediaFileReader.js";

export type XHRCallbackType = Promise<XMLHttpRequest>;

export type CharsetType =
  | "utf-16"
  | "utf-16le"
  | "utf-16be"
  | "utf-8"
  | "iso-8859-1";

export interface ByteRange {
  /**
   * A negative offset is relative to the end of the file.
  */
  offset: number;
  length: number;
}

export type TypedArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array;

export type DataType = string | number[] | TypedArray;

export interface ChunkType {
  offset: number;
  data: DataType;
}

export type ByteArray = number[];

export type FrameReaderSignature = (
  offset: number,
  length: number,
  data: MediaFileReader,
  flags?: Object | null,
  id3header?: TagHeader
) => any;

export interface TagFrames {
  [key: string]: TagFrame;
}

export interface TagFrame {
  id: string;
  size: number;
  description: string;
  data: any;
}

export interface TagFrameHeader {
  id: string;
  size: number;
  headerSize: number;
  flags?: TagFrameFlags | null;
}

export interface TagFrameFlags {
  message: {
    tag_alter_preservation: boolean;
    file_alter_preservation: boolean;
    read_only: boolean;
  };
  format: {
    grouping_identity: boolean;
    compression: boolean;
    encryption: boolean;
    unsynchronisation: boolean;
    data_length_indicator: boolean;
  };
}

export interface TagHeader {
  version: string;
  major: number;
  revision: number;
  flags: TagHeaderFlags;
  size: number;
}

export interface TagHeaderFlags {
  unsynchronisation: boolean;
  extended_header: boolean;
  experimental_indicator: boolean;
  footer_present: boolean;
}

export interface TagType {
  type: string;
  ftyp?: string;
  version?: string;
  tags: Tags;
}

export type Tags = ShortcutTags & TagFrames;

export interface ShortcutTags {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  comment?: string;
  track?: number;
  genre?: string;
  picture?: PictureType;
  lyrics?: string;
}

export interface PictureType {
  format: string;
  type: string;
  description: string;
  data: ByteArray;
}

export interface FrameType {
  id: string;
  description: string;
  data: any;
}