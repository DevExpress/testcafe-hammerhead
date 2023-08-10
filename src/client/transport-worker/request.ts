import { ServiceMessage } from '../../typings/proxy';
import BUILTIN_HEADERS from '../../request-pipeline/builtin-header-names';
import { getLocation } from '../utils/destination-location';
interface RequestContext {
    url: string;
    msg: ServiceMessage;
    callback: (err?: string, response?: any) => void;
    handleEvent: (e: ProgressEvent) => void;
}

function handleResolve (ctx: RequestContext, e: ProgressEvent) {
    const xhr = e.target as XMLHttpRequest;

    // NOTE: The 500 status code is returned by server when an error occurred into service message handler
    if (xhr.status === 500 && xhr.responseText) {
        ctx.msg.disableResending = true;

        handleReject(ctx, e);
    }
    else
        ctx.callback(null, xhr.responseText && JSON.parse(xhr.responseText));
}

function handleReject (ctx: RequestContext, e: ProgressEvent) {
    const xhr = e.target as XMLHttpRequest;

    if (ctx.msg.disableResending) {
        let errorMsg = `XHR request failed with ${xhr.status} status code.`;

        if (xhr.responseText)
            errorMsg += `\nError message: ${xhr.responseText}`;

        ctx.callback(errorMsg);
    }
    else {
        ctx.msg.disableResending = true;

        request(ctx.url, ctx.msg, ctx.callback);
    }
}

function handleEvent (this: RequestContext, e: ProgressEvent) {
    const ctx = this;

    if (e.type === 'load')
        handleResolve(ctx, e);
    else
        handleReject(ctx, e);
}

export default function request (url: string, msg: ServiceMessage, callback: RequestContext['callback']) {
    const location    = getLocation();
    const locationUrl = new URL(location);
    const requestUrl  = new URL(url, location);

    const xhr                 = new XMLHttpRequest();
    const ctx: RequestContext = { url, msg, callback, handleEvent };

    // eslint-disable-next-line no-restricted-properties
    xhr.open('POST', locationUrl.origin + requestUrl.pathname, true);
    xhr.setRequestHeader(BUILTIN_HEADERS.cacheControl, 'no-cache, no-store, must-revalidate');

    xhr.addEventListener('load', ctx);
    xhr.addEventListener('abort', ctx);
    xhr.addEventListener('error', ctx);
    xhr.addEventListener('timeout', ctx);

    xhr.send(JSON.stringify(msg));
}
