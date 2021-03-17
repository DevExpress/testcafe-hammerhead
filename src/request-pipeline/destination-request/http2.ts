import http2, { ClientHttp2Session, Http2Stream, IncomingHttpHeaders, IncomingHttpStatusHeader } from 'http2';
import LRUCache from 'lru-cache';
import RequestOptions from '../request-options';
import { isConnectionResetError } from '../connection-reset-guard';
import logger from '../../utils/logger';

const {
    HTTP2_HEADER_PATH,
    HTTP2_HEADER_STATUS,
    HTTP2_HEADER_METHOD,
    HTTP2_HEADER_AUTHORITY,
    HTTP2_HEADER_CONNECTION,
    HTTP2_HEADER_UPGRADE,
    HTTP2_HEADER_KEEP_ALIVE,
    HTTP2_HEADER_PROXY_CONNECTION,
    HTTP2_HEADER_TRANSFER_ENCODING,
    HTTP2_HEADER_HTTP2_SETTINGS,
    HTTP2_HEADER_HOST
} = http2.constants;

const HTTP2_SESSIONS_CACHE_SIZE = 100;
const HTTP2_SESSION_TIMEOUT     = 60_000;

const unsupportedOrigins = [] as string[];
const pendingSessions    = new Map<string, Promise<ClientHttp2Session | null>>();
const sessionsCache      = new LRUCache<string, ClientHttp2Session>({
    max:     HTTP2_SESSIONS_CACHE_SIZE,
    dispose: (_, session) => {
        if (!session.closed)
            session.close();
    }
});

export async function getHttp2Session (requestId: string, origin: string): Promise<ClientHttp2Session | null> {
    if (sessionsCache.has(origin))
        return sessionsCache.get(origin);

    if (pendingSessions.has(origin))
        return pendingSessions.get(origin);

    if (unsupportedOrigins.includes(origin))
        return null;

    const pendingSession = new Promise<ClientHttp2Session | null>(resolve => {
        const session = http2.connect(origin, { settings: { enablePush: false } });

        const errorHandler = (err: Error) => {
            pendingSessions.delete(origin);

            if (err['code'] === 'ERR_HTTP2_ERROR')
                unsupportedOrigins.push(origin);

            resolve(null);
        };

        session.once('error', errorHandler);
        session.once('localSettings', () => {
            pendingSessions.delete(origin);
            sessionsCache.set(origin, session);

            logger.destination.onHttp2SessionCreated(requestId, origin, sessionsCache.length, HTTP2_SESSIONS_CACHE_SIZE);

            session.off('error', errorHandler);
            session.once('close', () => {
                sessionsCache.del(origin);
                logger.destination.onHttp2SessionClosed(requestId, origin, sessionsCache.length, HTTP2_SESSIONS_CACHE_SIZE);
            });
            session.once('error', (err: Error) => {
                if (!isConnectionResetError(err)) {
                    logger.destination.onHttp2Error(requestId, origin, err);
                    throw err;
                }
            })
            session.setTimeout(HTTP2_SESSION_TIMEOUT, () => {
                logger.destination.onHttp2SessionTimeout(origin, HTTP2_SESSION_TIMEOUT);
                sessionsCache.del(origin);
            });

            resolve(session);
        });
    });

    pendingSessions.set(origin, pendingSession);

    return pendingSession;
}

export function formatRequestHttp2Headers (opts: RequestOptions) {
    const headers = Object.assign({}, opts.headers);

    headers[HTTP2_HEADER_METHOD]    = opts.method;
    headers[HTTP2_HEADER_PATH]      = opts.path;
    headers[HTTP2_HEADER_AUTHORITY] = headers.host;

    delete headers[HTTP2_HEADER_CONNECTION];
    delete headers[HTTP2_HEADER_UPGRADE];
    delete headers[HTTP2_HEADER_HTTP2_SETTINGS];
    delete headers[HTTP2_HEADER_KEEP_ALIVE];
    delete headers[HTTP2_HEADER_PROXY_CONNECTION];
    delete headers[HTTP2_HEADER_TRANSFER_ENCODING];
    delete headers[HTTP2_HEADER_HOST];

    return headers;
}

export interface Http2Response extends Http2Stream {
    statusCode: number;
    trailers:   { [key: string]: string };
    headers:    IncomingHttpHeaders;
}

export function makePseudoResponse (stream: Http2Stream, response: IncomingHttpHeaders & IncomingHttpStatusHeader): Http2Response {
    const statusCode = response[HTTP2_HEADER_STATUS] as unknown as number;
    const headers    = Object.assign({}, response);

    delete headers[HTTP2_HEADER_STATUS];

    return Object.assign(stream, {
        trailers: {},
        statusCode,
        headers
    });
}
