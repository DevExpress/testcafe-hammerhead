import zlib from 'zlib';
import { promisify } from 'util';

// NOTE: Brotli encoding support was backported to the 10.x Node.js version (starts from 10.16).
// https://github.com/nodejs/node/pull/24938

// However, we can't remove the 'brotli' module right now to not make trouble customers with versions from 10.0 to 10.15.
// We will remove the 'brotli' module after 10.x version support is ended (2021-04-30)

const hasBuiltInBrotliSupport = 'brotliCompress' in zlib;

// @ts-ignore
const builtInBrotliCompress = hasBuiltInBrotliSupport ? promisify(zlib.brotliCompress) : null;
// @ts-ignore
const builtInBrotliDecompress = hasBuiltInBrotliSupport ? promisify(zlib.brotliDecompress): null;

export function brotliCompress(data: zlib.InputType): Promise<Buffer> {
    return hasBuiltInBrotliSupport ? builtInBrotliCompress(data): Buffer.from(require('brotli').compress(data));
}

export function brotliDecompress(data: zlib.InputType): Promise<Buffer> {
    return hasBuiltInBrotliSupport ? builtInBrotliDecompress(data): Buffer.from(require('brotli').decompress(data));
}
