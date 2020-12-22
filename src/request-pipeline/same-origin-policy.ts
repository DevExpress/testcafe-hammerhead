import RequestPipelineContext from './context';
import BUILTIN_HEADERS from './builtin-header-names';
import { castArray } from 'lodash';
import { Credentials } from '../utils/url';

// NOTE: https://developer.mozilla.org/en-US/docs/Web/HTTP/Access_control_CORS
export function check (ctx: RequestPipelineContext): boolean {
    const reqOrigin              = ctx.dest.reqOrigin;

    // PASSED: Same origin.
    if (ctx.dest.domain === reqOrigin)
        return true;

    const withCredentials        = ctx.dest.credentials === Credentials.include;
    const allowOriginHeader      = ctx.destRes.headers[BUILTIN_HEADERS.accessControlAllowOrigin];
    const allowCredentialsHeader = ctx.destRes.headers[BUILTIN_HEADERS.accessControlAllowCredentials];
    const allowCredentials       = String(allowCredentialsHeader).toLowerCase() === 'true';
    const allowedOrigins         = castArray(allowOriginHeader);
    const wildcardAllowed        = allowedOrigins.includes('*');

    // FAILED: Destination server doesn't provide the Access-Control-Allow-Origin header.
    // So cross-domain requests are denied
    if (!allowOriginHeader)
        return false;

    // FAILED: Credentialed requests are not allowed or wild carding was used
    // for the allowed origin (credentialed requests should specify the exact domain).
    if (withCredentials && (!allowCredentials || wildcardAllowed))
        return false;

    // FINAL CHECK: The request origin should match one of the allowed origins.
    return wildcardAllowed || allowedOrigins.includes(reqOrigin);
}

export function shouldOmitCredentials (ctx: RequestPipelineContext): boolean {
    switch (ctx.dest.credentials) {
        case Credentials.omit:
            return true;
        case Credentials.sameOrigin:
            return ctx.dest.reqOrigin !== ctx.dest.domain;
        case Credentials.include:
            return false;
        default:
            return false;
    }
}
