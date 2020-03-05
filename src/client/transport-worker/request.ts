import { ServiceMessage } from '../../typings/proxy';

const MAX_RETRIES = 3;

interface RequestContext {
    url: string;
    msg: ServiceMessage;
    callback: (err?: string, response?: any) => void;
    handleEvent: (e: ProgressEvent) => void;
    retries: number;
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
        ctx.retries = Math.min(MAX_RETRIES, ctx.retries + 1);

        if (ctx.retries === MAX_RETRIES) {
            ctx.msg.disableResending = true;
        }

        // Reloading the page as iframe is not loaded
        window.location.reload();

        request(ctx.url, ctx.msg, ctx.callback);
    }
}

function handleEvent (e: ProgressEvent) {
    const ctx = this as RequestContext;

    if (e.type === 'load')
        handleResolve(ctx, e);
    else
        handleReject(ctx, e);
}

export default function request (url: string, msg: ServiceMessage, callback: RequestContext['callback']) {
    const xhr                 = new XMLHttpRequest();
    const ctx: RequestContext = { url, msg, callback, handleEvent, retries: 0 };

    xhr.open('POST', url, true);
    xhr.setRequestHeader('cache-control', 'no-cache, no-store, must-revalidate');

    xhr.addEventListener('load', ctx);
    xhr.addEventListener('abort', ctx);
    xhr.addEventListener('error', ctx);
    xhr.addEventListener('timeout', ctx);

    xhr.send(JSON.stringify(msg));
}
