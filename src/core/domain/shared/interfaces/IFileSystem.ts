export interface FileSystemEntry {
  name: string;
  isDirectory: boolean;
  isFile: boolean;
}

export interface IFileSystem {
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  writeFile(path: string, content: string, encoding?: string): Promise<void>;
  access(path: string): Promise<void>;
  readdir(path: string): Promise<FileSystemEntry[]>;
  resolve(...paths: string[]): string;
}
