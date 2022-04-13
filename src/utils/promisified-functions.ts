import zlib, {
    BrotliOptions,
    InputType,
    ZlibOptions,
} from 'zlib';

import { promisify } from 'util';
import fs from 'fs';
import childProcess from 'child_process';

export const gzip: (buf: InputType, options?: ZlibOptions) => Promise<Buffer>               = promisify(zlib.gzip);
export const deflate: (buf: InputType, options?: ZlibOptions) => Promise<Buffer>            = promisify(zlib.deflate);
export const gunzip: (buf: InputType, options?: ZlibOptions) => Promise<Buffer>             = promisify(zlib.gunzip);
export const inflate: (buf: InputType, options?: ZlibOptions) => Promise<Buffer>            = promisify(zlib.inflate);
export const inflateRaw: (buf: InputType, options?: ZlibOptions) => Promise<Buffer>         = promisify(zlib.inflateRaw);
export const brotliCompress: (buf: InputType, options?: BrotliOptions) => Promise<Buffer>   = promisify(zlib.brotliCompress);
export const brotliDecompress: (buf: InputType, options?: BrotliOptions) => Promise<Buffer> = promisify(zlib.brotliDecompress);

export const readDir: (path: string) => Promise<string[]> = promisify(fs.readdir);
export const readFile                                     = promisify(fs.readFile);
export const stat                                         = promisify(fs.stat);
export const access                                       = promisify(fs.access);
export const makeDir                                      = promisify(fs.mkdir);
export const writeFile                                    = promisify(fs.writeFile);
export const fsObjectExists                               = (fsPath: string) => stat(fsPath).then(() => true, () => false);

export const exec = promisify(childProcess.exec);
