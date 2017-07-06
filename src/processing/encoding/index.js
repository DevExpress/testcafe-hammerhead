import zlib from 'zlib';
import charsetEncoder from 'iconv-lite';
import promisify from '../../utils/promisify';

const gzip       = promisify(zlib.gzip);
const deflate    = promisify(zlib.deflate);
const gunzip     = promisify(zlib.gunzip);
const inflate    = promisify(zlib.inflate);
const inflateRaw = promisify(zlib.inflateRaw);

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
    if (encoding === GZIP_CONTENT_ENCODING)
        content = await gunzip(content);

    else if (encoding === DEFLATE_CONTENT_ENCODING)
        content = await inflateWithFallback(content);

    else if (encoding === BROTLI_CONTENT_ENCODING)
        content = new Buffer(require('brotli').decompress(content));

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
        return new Buffer(require('brotli').compress(content));

    return content;
}
