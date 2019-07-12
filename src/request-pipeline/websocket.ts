/*eslint-disable no-unused-vars*/
import net from 'net';
import RequestPipelineContext from './context';
import { OutgoingHttpHeaders, IncomingMessage } from 'http';
/*eslint-enable no-unused-vars*/
import * as headerTransforms from './header-transforms';

function writeWebSocketHead (socket: net.Socket, destRes: IncomingMessage, headers: OutgoingHttpHeaders) {
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

export function respondOnWebSocket (ctx: RequestPipelineContext) {
    const headers = headerTransforms.forResponse(ctx);
    const destRes = <IncomingMessage>ctx.destRes;

    writeWebSocketHead(<net.Socket>ctx.res, destRes, headers);

    destRes.socket.pipe(ctx.res);
    ctx.res.pipe(destRes.socket);
}
