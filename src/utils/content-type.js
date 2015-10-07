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

    return PAGE_MIMES.some(mime => header.indexOf(mime) > -1);
}

export function isCSSResource (contentTypeHeader, acceptHeader) {
    return contentTypeHeader.toLowerCase().indexOf(CSS_MIME) > -1 ||
           acceptHeader.toLowerCase() === CSS_MIME;
}

export function isScriptResource (contentTypeHeader, acceptHeader) {
    contentTypeHeader = contentTypeHeader.toLowerCase();
    acceptHeader      = acceptHeader.toLowerCase();

    return SCRIPT_MIMES.some(mime => contentTypeHeader.indexOf(mime) > -1) ||
           SCRIPT_MIMES.indexOf(acceptHeader) > -1;
}

export function isManifest (contentTypeHeader) {
    return contentTypeHeader.toLowerCase().indexOf(MANIFEST_MIME) > -1;
}

export function isJSON (contentTypeHeader) {
    return contentTypeHeader.toLowerCase().indexOf(JSON_MIME) > -1;
}

