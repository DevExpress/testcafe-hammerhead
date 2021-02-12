import http2, { ClientHttp2Session, Http2Stream, IncomingHttpHeaders, IncomingHttpStatusHeader } from 'http2';
import LRUCache from 'lru-cache';
import RequestOptions from '../request-options';

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
    HTTP2_HEADER_HTTP2_SETTINGS
} = http2.constants;

const HTTP2_SESSIONS_CACHE_SIZE = 100;

// google close unused session after 4min

const unsupportedOrigins = [] as string[];
const pendingSessions    = new Map<string, Promise<ClientHttp2Session | null>>();
const sessionsCache      = new LRUCache<string, ClientHttp2Session>({
    max:     HTTP2_SESSIONS_CACHE_SIZE,
    dispose: (_, session) => {
        session.destroy();
    }
});

export async function getHttp2Session (origin: string): Promise<ClientHttp2Session | null> {
    if (sessionsCache.has(origin))
        return sessionsCache.get(origin);

    if (pendingSessions.has(origin))
        return pendingSessions.get(origin);

    if (unsupportedOrigins.includes(origin))
        return null;

    const pendingSession = new Promise<ClientHttp2Session | null>(resolve => {
        const session = http2.connect(origin, { settings: { enablePush: false } });

        const errorBeforeConnectedHandler = (err) => {
            pendingSessions.delete(origin);

            if (err.code === 'ERR_HTTP2_ERROR')
                unsupportedOrigins.push(origin);
            // else
            //     console.log('error', Date.now(), err); // eslint-disable-line

            resolve(null);
        };

        // const errorAfterConnectedHandler = (err) => {
        //     console.log('error', Date.now(), err); // eslint-disable-line
        // };

        const closeHandler = () => {
            // console.log('close', Date.now(), origin); // eslint-disable-line
            sessionsCache.del(origin);
        };

        session.on('error', errorBeforeConnectedHandler);
        session.once('localSettings', () => {
            // console.log('connected', Date.now(), origin); // eslint-disable-line
            pendingSessions.delete(origin);
            sessionsCache.set(origin, session);
            session.off('error', errorBeforeConnectedHandler);
            //session.once('error', errorAfterConnectedHandler);
            session.once('close', closeHandler);

            resolve(session);
        });

        //setTimeout

        // TODO: altsvc and origin events
        // .on('altsvc', (alt: string, origin: string, streamId: number) => {
        //     console.log('altsvc', Date.now(), alt, origin, streamId); // eslint-disable-line
        // })
        // .on('origin', (origins: string[]) => {
        //     console.log('origin', Date.now(), origins); // eslint-disable-line
        // })
    });

    pendingSessions.set(origin, pendingSession);

    return pendingSession;
}

export function formatRequestHttp2Headers (opts: RequestOptions) {
    const headers = Object.assign({}, opts.headers);

    headers[HTTP2_HEADER_METHOD]    = opts.method;
    headers[HTTP2_HEADER_PATH]      = opts.path;
    headers[HTTP2_HEADER_AUTHORITY] = opts.headers.host;

    delete headers[HTTP2_HEADER_CONNECTION];
    delete headers[HTTP2_HEADER_UPGRADE];
    delete headers[HTTP2_HEADER_HTTP2_SETTINGS];
    delete headers[HTTP2_HEADER_KEEP_ALIVE];
    delete headers[HTTP2_HEADER_PROXY_CONNECTION];
    delete headers[HTTP2_HEADER_TRANSFER_ENCODING];
    delete headers.host;

    return headers;
}

export function makePseudoResponse (stream: Http2Stream, response: IncomingHttpHeaders & IncomingHttpStatusHeader) {
    const headers = Object.assign({}, response);

    delete headers[HTTP2_HEADER_STATUS];

    Object.assign(stream, {
        statusCode: response[HTTP2_HEADER_STATUS],
        trailers:   {},
        headers
    });
}
