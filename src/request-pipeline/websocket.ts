import net from 'net';
import RequestPipelineContext from './context';
import { OutgoingHttpHeaders, IncomingMessage } from 'http';
import * as headerTransforms from './header-transforms';

function writeWebSocketHead (socket: net.Socket, destRes: IncomingMessage, headers: OutgoingHttpHeaders): void {
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

export function respondOnWebSocket (ctx: RequestPipelineContext): void {
    const headers = headerTransforms.forResponse(ctx);
    const destRes = ctx.destRes as IncomingMessage;
    const res     = ctx.res as net.Socket;

    writeWebSocketHead(res, destRes, headers);

    const unpipe = () => {
        res.unpipe(destRes.socket);
        destRes.socket.unpipe(res);
    };

    destRes.socket.on('end', unpipe);
    res.on('end', unpipe);

    destRes.socket.pipe(res);
    res.pipe(destRes.socket);
}
