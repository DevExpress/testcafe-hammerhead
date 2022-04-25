// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import BUILTIN_HEADERS from '../request-pipeline/builtin-header-names';

const AUTHENTICATE_PREFIX  = '~~~TestCafe added this prefix to hide the authentication dialog box~~~';
const AUTHORIZATION_PREFIX = '~~~TestCafe added this prefix to control the authorization flow~~~';

export function addAuthenticatePrefix (value: string) {
    return AUTHENTICATE_PREFIX + value;
}

export function hasAuthenticatePrefix (value: string) {
    return value.indexOf(AUTHENTICATE_PREFIX) > -1;
}

export function removeAuthenticatePrefix (value: string) {
    return value.replace(AUTHENTICATE_PREFIX, '');
}

export function isAuthenticateHeader (headerName: any) {
    const headerNameStr = String(headerName).toLowerCase();

    return headerNameStr === BUILTIN_HEADERS.wwwAuthenticate || headerNameStr === BUILTIN_HEADERS.proxyAuthenticate;
}


export function addAuthorizationPrefix (value: string) {
    return AUTHORIZATION_PREFIX + value;
}

export function hasAuthorizationPrefix (value: string) {
    return value.indexOf(AUTHORIZATION_PREFIX) > -1;
}

export function removeAuthorizationPrefix (value: string) {
    return value.replace(AUTHORIZATION_PREFIX, '');
}

export function isAuthorizationHeader (headerName: any) {
    const headerNameStr = String(headerName).toLowerCase();

    return headerNameStr === BUILTIN_HEADERS.authorization || headerNameStr === BUILTIN_HEADERS.proxyAuthorization;
}
