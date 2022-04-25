import zlib from 'zlib';

import {
    gzip,
    deflate,
    gunzip,
    inflate,
    inflateRaw,
    brotliCompress,
    brotliDecompress,
} from '../../utils/promisified-functions';

import charsetEncoder from 'iconv-lite';
import Charset from './charset';

const enum CONTENT_ENCODING { // eslint-disable-line no-shadow
    GZIP = 'gzip',
    DEFLATE = 'deflate',
    BROTLI = 'br'
}

// NOTE: https://github.com/request/request/pull/2492/files
// Be more lenient with decoding compressed responses, since (very rarely)
// servers send slightly invalid gzip responses that are still accepted
// by common browsers.
// Always using Z_SYNC_FLUSH is what cURL does.
// GH-1915
const GZIP_DECODING_OPTIONS = {
    flush:       zlib.Z_SYNC_FLUSH,
    finishFlush: zlib.Z_SYNC_FLUSH,
};

// NOTE: https://github.com/DevExpress/testcafe-hammerhead/issues/2743
// The default compression level (11) causes the strong performance degradation.
// This is why, we decrease the compression level same as other frameworks
// (https://github.com/dotnet/runtime/issues/26097, https://github.com/koajs/compress/issues/121)

const BROTLI_DECODING_OPTIONS = {
    params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 5,
    },
};

// NOTE: IIS has a bug when it sends 'raw deflate' compressed data for the 'Deflate' Accept-Encoding header.
// (see: http://zoompf.com/2012/02/lose-the-wait-http-compression)
async function inflateWithFallback (data: Buffer): Promise<Buffer> {
    try {
        return await inflate(data);
    }
    catch (err) {
        if (err.code === 'Z_DATA_ERROR')
            return await inflateRaw(data);

        throw err;
    }
}

export async function decodeContent (content: Buffer, encoding: string, charset: Charset): Promise<string> {
    if (encoding === CONTENT_ENCODING.GZIP)
        content = await gunzip(content, GZIP_DECODING_OPTIONS);

    else if (encoding === CONTENT_ENCODING.DEFLATE)
        content = await inflateWithFallback(content);

    else if (encoding === CONTENT_ENCODING.BROTLI)
        content = await brotliDecompress(content, BROTLI_DECODING_OPTIONS);

    charset.fromBOM(content);

    return charsetEncoder.decode(content, charset.get());
}

export async function encodeContent (content: string, encoding: string, charset: Charset): Promise<Buffer> {
    const encodedContent = charsetEncoder.encode(content, charset.get(), { addBOM: charset.isFromBOM() });

    if (encoding === CONTENT_ENCODING.GZIP)
        return gzip(encodedContent);

    if (encoding === CONTENT_ENCODING.DEFLATE)
        return deflate(encodedContent);

    if (encoding === CONTENT_ENCODING.BROTLI)
        return brotliCompress(encodedContent, BROTLI_DECODING_OPTIONS);

    return encodedContent;
}
