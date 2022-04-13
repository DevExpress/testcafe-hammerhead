const MANIFEST_MIME = 'text/cache-manifest';
const CSS_MIME      = 'text/css';

export const JSON_MIME = 'application/json';

const PAGE_MIMES = [
    'text/html',
    'text/xml',
    'application/xhtml+xml',
    'application/xml',
    'application/x-ms-application',
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
    'text/x-javascript',
];

const TEXT_PAGE_MIMES = [
    'text/plain',
];

export function isPage (header: string): boolean {
    header = header.toLowerCase();

    return PAGE_MIMES.some(mime => header.includes(mime));
}

export function isTextPage (contentTypeHeader: string): boolean {
    contentTypeHeader = contentTypeHeader.toLowerCase();

    return TEXT_PAGE_MIMES.some(mime => contentTypeHeader.includes(mime)) || !contentTypeHeader;
}

export function isCSSResource (contentTypeHeader: string, acceptHeader: string) {
    return contentTypeHeader.toLowerCase().includes(CSS_MIME) ||
           acceptHeader.toLowerCase().includes(CSS_MIME);
}

export function isScriptResource (contentTypeHeader: string, acceptHeader: string) {
    contentTypeHeader = contentTypeHeader.toLowerCase();
    acceptHeader      = acceptHeader.toLowerCase();

    return SCRIPT_MIMES.some(mime => contentTypeHeader.includes(mime)) ||
           SCRIPT_MIMES.includes(acceptHeader);
}

export function isManifest (contentTypeHeader: string) {
    return contentTypeHeader.toLowerCase().includes(MANIFEST_MIME);
}

