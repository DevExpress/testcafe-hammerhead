import charsetEncoder from 'iconv-lite';
import promisify from './promisify';
import zlib from 'zlib';

var gzip       = promisify(zlib.gzip);
var deflate    = promisify(zlib.deflate);
var gunzip     = promisify(zlib.gunzip);
var inflate    = promisify(zlib.inflate);
var inflateRaw = promisify(zlib.inflateRaw);

// Const
const JSON_MIME       = 'application/json';
const MANIFEST_MIME   = 'text/cache-manifest';
const CSS_MIME        = 'text/css';

const PAGE_MIMES = [
    'text/html',
    'application/xhtml+xml',
    'application/xml',
    'application/x-ms-application'
];

const SCRIPT_MIMES = [
    'application/javascript',
    'text/javascript',
    'application/x-javascript'
];


// Content type
export function isPage (header) {
    header = header.toLowerCase();

    return PAGE_MIMES.some((mime) => header.indexOf(mime) > -1);
}

export function isCSSResource (contentTypeHeader, acceptHeader) {
    return contentTypeHeader.toLowerCase().indexOf(CSS_MIME) > -1 ||
           acceptHeader.toLowerCase() === CSS_MIME;
}

export function isScriptResource (contentTypeHeader, acceptHeader) {
    contentTypeHeader = contentTypeHeader.toLowerCase();
    acceptHeader      = acceptHeader.toLowerCase();

    return SCRIPT_MIMES.some((mime) => contentTypeHeader.indexOf(mime) > -1) ||
           SCRIPT_MIMES.indexOf(acceptHeader) > -1;
}

export function isManifest (contentTypeHeader) {
    return contentTypeHeader.toLowerCase().indexOf(MANIFEST_MIME) > -1;
}

export function isJSON (contentTypeHeader) {
    return contentTypeHeader.toLowerCase().indexOf(JSON_MIME) > -1;
}

// Encoding / decoding

// NOTE: IIS has a bug then it sends 'raw deflate' compressed
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
