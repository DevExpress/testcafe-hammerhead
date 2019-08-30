import zlib from 'zlib';
import { promisify } from 'util';
import fs from 'fs';
import childProcess from 'child_process';

export const gzip: (buf: zlib.InputType, options?: zlib.ZlibOptions) => Promise<Buffer>       = promisify(zlib.gzip);
export const deflate: (buf: zlib.InputType, options?: zlib.ZlibOptions) => Promise<Buffer>    = promisify(zlib.deflate);
export const gunzip: (buf: zlib.InputType, options?: zlib.ZlibOptions) => Promise<Buffer>     = promisify(zlib.gunzip);
export const inflate: (buf: zlib.InputType, options?: zlib.ZlibOptions) => Promise<Buffer>    = promisify(zlib.inflate);
export const inflateRaw: (buf: zlib.InputType, options?: zlib.ZlibOptions) => Promise<Buffer> = promisify(zlib.inflateRaw);
export const readDir: (path: string) => Promise<Array<string>>                                = promisify(fs.readdir);

export const readFile       = promisify(fs.readFile);
export const stat           = promisify(fs.stat);
export const access         = promisify(fs.access);
export const makeDir        = promisify(fs.mkdir);
export const writeFile      = promisify(fs.writeFile);
export const fsObjectExists = (fsPath: string) => stat(fsPath).then(() => true, () => false);

export const exec = promisify(childProcess.exec);
