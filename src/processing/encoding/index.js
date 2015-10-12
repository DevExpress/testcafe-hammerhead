import zlib from 'zlib';
import charsetEncoder from 'iconv-lite';
import promisify from 'es6-promisify';

var gzip       = promisify(zlib.gzip);
var deflate    = promisify(zlib.deflate);
var gunzip     = promisify(zlib.gunzip);
var inflate    = promisify(zlib.inflate);
var inflateRaw = promisify(zlib.inflateRaw);

// NOTE: IIS has a bug when it sends 'raw deflate' compressed
// data for 'Deflate' Accept-Encoding header.
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
    if (encoding === 'gzip')
        content = await gunzip(content);

    else if (encoding === 'deflate')
        content = await inflateWithFallback(content);

    charset.fromBOM(content);

    return charsetEncoder.decode(content, charset.get());
}

export async function encodeContent (content, encoding, charset) {
    content = charsetEncoder.encode(content, charset.get(), { addBOM: charset.isFromBOM() });

    if (encoding === 'gzip')
        return gzip(content);

    if (encoding === 'deflate')
        return deflate(content);

    return content;
}
