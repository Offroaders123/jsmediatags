declare module "react-native-fs" {
  type StatResult = {
    name: string | undefined;
    path: string;
    size: number;
    mode: number;
    ctime: number;
    mtime: number;
    originalFilepath: string;
    isFile: () => boolean;
    isDirectory: () => boolean;
  }

  export function stat(filepath: string): Promise<StatResult>;
  export function read(filepath: string, length?: number, position?: number, encodingOrOptions?: any): Promise<string>;
}