import BUILTIN_HEADERS from '../../request-pipeline/builtin-header-names';
import INTERNAL_HEADERS from '../../request-pipeline/internal-header-names';

export function transformRequestHeaderNameToInternal (headerName: any) {
    if (typeof headerName === 'string') {
        headerName = headerName.toLowerCase();

        if (headerName === BUILTIN_HEADERS.authorization)
            headerName = INTERNAL_HEADERS.authorization;
        else if (headerName === BUILTIN_HEADERS.proxyAuthorization)
            headerName = INTERNAL_HEADERS.proxyAuthorization;
    }

    return headerName;
}

export function transformResponseHeaderNameToInternal (headerName: any) {
    if (typeof headerName === 'string') {
        headerName = headerName.toLowerCase();

        if (headerName === BUILTIN_HEADERS.wwwAuthenticate)
            headerName = INTERNAL_HEADERS.wwwAuthenticate;
        else if (headerName === BUILTIN_HEADERS.proxyAuthenticate)
            headerName = INTERNAL_HEADERS.proxyAuthenticate;
    }

    return headerName;
}

export function transformHeaderNameToBuiltin (headerName: any) {
    if (typeof headerName === 'string') {
        headerName = headerName.toLowerCase();

        if (headerName === INTERNAL_HEADERS.authorization)
            headerName = BUILTIN_HEADERS.authorization;
        else if (headerName === INTERNAL_HEADERS.proxyAuthorization)
            headerName = BUILTIN_HEADERS.proxyAuthorization;
        else if (headerName === INTERNAL_HEADERS.wwwAuthenticate)
            headerName = BUILTIN_HEADERS.wwwAuthenticate;
        else if (headerName === INTERNAL_HEADERS.proxyAuthenticate)
            headerName = BUILTIN_HEADERS.proxyAuthenticate;
    }

    return headerName;
}

export function transformHeaderNameToInternal (headerName: any) {
    if (typeof headerName === 'string') {
        headerName = headerName.toLowerCase();

        if (headerName === BUILTIN_HEADERS.authorization)
            headerName = INTERNAL_HEADERS.authorization;
        else if (headerName === BUILTIN_HEADERS.proxyAuthorization)
            headerName = INTERNAL_HEADERS.proxyAuthorization;
        else if (headerName === BUILTIN_HEADERS.wwwAuthenticate)
            headerName = INTERNAL_HEADERS.wwwAuthenticate;
        else if (headerName === BUILTIN_HEADERS.proxyAuthenticate)
            headerName = INTERNAL_HEADERS.proxyAuthenticate;
    }

    return headerName;
}
