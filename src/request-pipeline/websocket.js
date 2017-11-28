import * as headerTransforms from './header-transforms';

function writeWebSocketHead (socket, destRes, headers) {
    const { httpVersion, statusCode, statusMessage } = destRes;

    const resRaw       = [`HTTP/${httpVersion} ${statusCode} ${statusMessage}`];
    const headersNames = Object.keys(headers);

    for (const headerName of headersNames) {
        const headerValue = headers[headerName];

        if (Array.isArray(headerValue)) {
            for (const value of headerValue)
                resRaw.push(headerName + ': ' + value);
        }
        else
            resRaw.push(headerName + ': ' + headerValue);
    }

    resRaw.push('', '');

    socket.write(resRaw.join('\r\n'));
}

export function respondOnWebSocket (ctx) {
    const headers = headerTransforms.forResponse(ctx);

    writeWebSocketHead(ctx.res, ctx.destRes, headers);

    ctx.destRes.socket.pipe(ctx.res);
    ctx.res.pipe(ctx.destRes.socket);
}
