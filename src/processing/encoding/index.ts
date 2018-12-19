import zlib from 'zlib';
import { gzip, deflate, gunzip, inflate, inflateRaw } from '../../utils/promisified-functions';
import charsetEncoder from 'iconv-lite';

const GZIP_CONTENT_ENCODING    = 'gzip';
const DEFLATE_CONTENT_ENCODING = 'deflate';
const BROTLI_CONTENT_ENCODING  = 'br';

// NOTE: IIS has a bug when it sends 'raw deflate' compressed data for the 'Deflate' Accept-Encoding header.
// (see: http://zoompf.com/2012/02/lose-the-wait-http-compression)
async function inflateWithFallback (data) {
    try {
        return await inflate(data);
    }
    catch (err) {
        if (err.code === 'Z_DATA_ERROR')
            return await inflateRaw(data);

        throw err;
    }
}

export async function decodeContent (content, encoding, charset) {
    if (encoding === GZIP_CONTENT_ENCODING) {
        // NOTE: https://github.com/request/request/pull/2492/files
        // Be more lenient with decoding compressed responses, since (very rarely)
        // servers send slightly invalid gzip responses that are still accepted
        // by common browsers.
        // Always using Z_SYNC_FLUSH is what cURL does.
        // GH-1915
        content = await gunzip(content, { flush: zlib.Z_SYNC_FLUSH, finishFlush: zlib.Z_SYNC_FLUSH });
    }

    else if (encoding === DEFLATE_CONTENT_ENCODING)
        content = await inflateWithFallback(content);

    else if (encoding === BROTLI_CONTENT_ENCODING)
        content = Buffer.from(require('brotli').decompress(content));

    charset.fromBOM(content);

    return charsetEncoder.decode(content, charset.get());
}

export async function encodeContent (content, encoding, charset) {
    content = charsetEncoder.encode(content, charset.get(), { addBOM: charset.isFromBOM() });

    if (encoding === GZIP_CONTENT_ENCODING)
        return gzip(content);

    if (encoding === DEFLATE_CONTENT_ENCODING)
        return deflate(content);

    if (encoding === BROTLI_CONTENT_ENCODING)
        return Buffer.from(require('brotli').compress(content));

    return content;
}
