import BUILTIN_HEADERS from '../../request-pipeline/builtin-header-names';
import INTERNAL_HEADERS from '../../request-pipeline/internal-header-names';

const BUILTIN_TO_INTERNAL_HEADERS_MAP = new Map<string, string>();
const INTERNAL_TO_BUILTIN_HEADERS_MAP = new Map<string, string>();

BUILTIN_TO_INTERNAL_HEADERS_MAP.set(BUILTIN_HEADERS.authorization, INTERNAL_HEADERS.authorization);
BUILTIN_TO_INTERNAL_HEADERS_MAP.set(BUILTIN_HEADERS.proxyAuthorization, INTERNAL_HEADERS.proxyAuthorization);
BUILTIN_TO_INTERNAL_HEADERS_MAP.set(BUILTIN_HEADERS.wwwAuthenticate, INTERNAL_HEADERS.wwwAuthenticate);
BUILTIN_TO_INTERNAL_HEADERS_MAP.set(BUILTIN_HEADERS.proxyAuthenticate, INTERNAL_HEADERS.proxyAuthenticate);

INTERNAL_TO_BUILTIN_HEADERS_MAP.set(INTERNAL_HEADERS.authorization, BUILTIN_HEADERS.authorization);
INTERNAL_TO_BUILTIN_HEADERS_MAP.set(INTERNAL_HEADERS.proxyAuthorization, BUILTIN_HEADERS.proxyAuthorization);
INTERNAL_TO_BUILTIN_HEADERS_MAP.set(INTERNAL_HEADERS.wwwAuthenticate, BUILTIN_HEADERS.wwwAuthenticate);
INTERNAL_TO_BUILTIN_HEADERS_MAP.set(INTERNAL_HEADERS.proxyAuthenticate, BUILTIN_HEADERS.proxyAuthenticate);

export function transformHeaderNameToBuiltin (headerName: any) {
    if (typeof headerName === 'string')
        return INTERNAL_TO_BUILTIN_HEADERS_MAP.get(headerName.toLowerCase()) || headerName;

    return headerName;
}

export function transformHeaderNameToInternal (headerName: any) {
    if (typeof headerName === 'string')
        return BUILTIN_TO_INTERNAL_HEADERS_MAP.get(headerName.toLowerCase()) || headerName;

    return headerName;
}
