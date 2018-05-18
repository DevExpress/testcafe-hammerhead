// Const
const MANIFEST_MIME = 'text/cache-manifest';
const CSS_MIME      = 'text/css';

export const JSON_MIME = 'application/json';

const PAGE_MIMES = [
    'text/html',
    'text/xml',
    'application/xhtml+xml',
    'application/xml',
    'application/x-ms-application'
];

const SCRIPT_MIMES = [
    'application/ecmascript',
    'application/javascript',
    'application/x-ecmascript',
    'application/x-javascript',
    'text/ecmascript',
    'text/javascript',
    'text/javascript1.0',
    'text/javascript1.1',
    'text/javascript1.2',
    'text/javascript1.3',
    'text/javascript1.4',
    'text/javascript1.5',
    'text/jscript',
    'text/livescript',
    'text/x-ecmascript',
    'text/x-javascript'
];


// Content type
export function isPage (header) {
    header = header.toLowerCase();

    return PAGE_MIMES.some(mime => header.includes(mime));
}

export function isCSSResource (contentTypeHeader, acceptHeader) {
    return contentTypeHeader.toLowerCase().includes(CSS_MIME) ||
           acceptHeader.toLowerCase().includes(CSS_MIME);
}

export function isScriptResource (contentTypeHeader, acceptHeader) {
    contentTypeHeader = contentTypeHeader.toLowerCase();
    acceptHeader      = acceptHeader.toLowerCase();

    return SCRIPT_MIMES.some(mime => contentTypeHeader.includes(mime)) ||
           SCRIPT_MIMES.includes(acceptHeader);
}

export function isManifest (contentTypeHeader) {
    return contentTypeHeader.toLowerCase().includes(MANIFEST_MIME);
}

