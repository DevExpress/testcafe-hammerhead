import zlib from 'zlib';
import promisify from './promisify';
import fs from 'fs';
import childProcess from 'child_process';

export const gzip       = promisify(zlib.gzip);
export const deflate    = promisify(zlib.deflate);
export const gunzip     = promisify(zlib.gunzip);
export const inflate    = promisify(zlib.inflate);
export const inflateRaw = promisify(zlib.inflateRaw);

export const readFile       = promisify(fs.readFile);
export const stat           = promisify(fs.stat);
export const access         = promisify(fs.access);
export const readDir        = promisify(fs.readdir);
export const makeDir        = promisify(fs.mkdir);
export const writeFile      = promisify(fs.writeFile);
export const fsObjectExists = fsPath => stat(fsPath).then(() => true, () => false);

export const exec = promisify(childProcess.exec);
