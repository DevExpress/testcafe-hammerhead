import { Readable } from 'stream';
import { ServerResponse, IncomingMessage } from 'http';
import { defaultsDeep as defaultOptions } from 'lodash';
import promisifyStream from '../utils/promisify-stream';

const STATIC_RESOURCES_DEFAULT_CACHING_OPTIONS = {
    maxAge:         30,
    mustRevalidate: true
};

export const PREVENT_CACHING_HEADERS = {
    'cache-control': 'no-cache, no-store, must-revalidate',
    'pragma':        'no-cache'
};

export function addPreventCachingHeaders (res: ServerResponse): void {
    res.setHeader('cache-control', PREVENT_CACHING_HEADERS['cache-control']);
    res.setHeader('pragma', PREVENT_CACHING_HEADERS['pragma']);
}

export function respond204 (res: ServerResponse): void {
    res.statusCode = 204;
    res.end();
}

export function respond404 (res: any): void {
    res.statusCode = 404;
    res.end();
}

export function respond500 (res: ServerResponse, err = ''): void {
    res.statusCode = 500;
    res.end(err);
}

export function respondWithJSON (res: ServerResponse, data: object, skipContentType: boolean): void {
    if (!skipContentType)
        res.setHeader('content-type', 'application/json');

    // NOTE: GH-105
    addPreventCachingHeaders(res);
    res.end(data ? JSON.stringify(data) : '');
}

export function respondStatic (req: IncomingMessage, res: any, resource: any, cachingOptions: any = {}): void {
    cachingOptions = defaultOptions(cachingOptions, STATIC_RESOURCES_DEFAULT_CACHING_OPTIONS);

    if (resource.etag === req.headers['if-none-match']) {
        res.statusCode = 304;
        res.end();
    }
    else {
        const { maxAge, mustRevalidate } = cachingOptions;

        res.setHeader('cache-control', `max-age=${maxAge}${mustRevalidate ? ', must-revalidate' : ''}`);
        res.setHeader('etag', resource.etag);
        res.setHeader('content-type', resource.contentType);
        res.end(resource.content);
    }
}

export function fetchBody (r: Readable): Promise<Buffer> {
    return promisifyStream(r);
}
