import XHR_HEADERS from './headers';
import castArray from 'cast-array';

export const SAME_ORIGIN_CHECK_FAILED_STATUS_CODE = 222;

// NOTE: https://developer.mozilla.org/en-US/docs/Web/HTTP/Access_control_CORS
export function check (ctx) {
    const reqOrigin = ctx.dest.reqOrigin;

    // PASSED: Same origin.
    if (ctx.dest.domain === reqOrigin)
        return true;

    // PASSED: We have a "preflight" request.
    if (ctx.req.method === 'OPTIONS')
        return true;

    const withCredentials        = !!ctx.req.headers[XHR_HEADERS.withCredentials] ||
                                   ctx.req.headers[XHR_HEADERS.fetchRequestCredentials] === 'include';
    const allowOriginHeader      = ctx.destRes.headers['access-control-allow-origin'];
    const allowCredentialsHeader = ctx.destRes.headers['access-control-allow-credentials'];
    const allowCredentials       = String(allowCredentialsHeader).toLowerCase() === 'true';
    const allowedOrigins         = castArray(allowOriginHeader);
    const wildcardAllowed        = allowedOrigins.indexOf('*') > -1;

    // FAILED: Destination server doesn't provide the Access-Control-Allow-Origin header.
    // So cross-domain requests are denied
    if (!allowOriginHeader)
        return false;

    // FAILED: Credentialed requests are not allowed or wild carding was used
    // for the allowed origin (credentialed requests should specify the exact domain).
    if (withCredentials && (!allowCredentials || wildcardAllowed))
        return false;

    // FINAL CHECK: The request origin should match one of the allowed origins.
    return wildcardAllowed || allowedOrigins.indexOf(reqOrigin) > -1;
}
