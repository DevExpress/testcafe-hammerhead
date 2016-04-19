import XHR_HEADERS from './headers';

// NOTE: https://developer.mozilla.org/en-US/docs/Web/HTTP/Access_control_CORS
export function check (ctx) {
    var reqOrigin = ctx.dest.reqOrigin;

    // PASSED: Same origin.
    if (ctx.dest.domain === reqOrigin)
        return true;

    // NOTE: Ok, we have a cross-origin request.
    var corsSupported = !!ctx.req.headers[XHR_HEADERS.corsSupported];

    // FAILED: CORS not supported.
    if (!corsSupported)
        return false;

    // PASSED: We have a "preflight" request.
    if (ctx.req.method === 'OPTIONS')
        return true;

    var withCredentials        = !!ctx.req.headers[XHR_HEADERS.withCredentials];
    var allowOriginHeader      = ctx.destRes.headers['access-control-allow-origin'];
    var allowCredentialsHeader = ctx.destRes.headers['access-control-allow-credentials'];
    var allowCredentials       = String(allowCredentialsHeader).toLowerCase() === 'true';
    var allowedOrigins         = Array.isArray(allowOriginHeader) ? allowOriginHeader : [allowOriginHeader];
    var wildcardAllowed        = allowedOrigins.indexOf('*') > -1;

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
