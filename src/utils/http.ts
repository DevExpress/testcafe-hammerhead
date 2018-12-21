import { defaultsDeep as defaultOptions } from 'lodash';
import promisifyStream from '../utils/promisify-stream';

const STATIC_RESOURCES_DEFAULT_CACHING_OPTIONS = {
    maxAge:         30,
    mustRevalidate: true
};

export function preventCaching (res: any) {
    res.setHeader('cache-control', 'no-cache, no-store, must-revalidate');
    res.setHeader('pragma', 'no-cache');
}

export function respond204 (res: any) {
    res.statusCode = 204;
    res.end();
}

export function respond404 (res: any) {
    res.statusCode = 404;
    res.end();
}

export function respond500 (res: any, err) {
    res.statusCode = 500;
    res.end(err || '');
}

export function respondWithJSON (res: any, data: any, skipContentType: boolean) {
    if (!skipContentType)
        res.setHeader('content-type', 'application/json');

    // NOTE: GH-105
    preventCaching(res);
    res.end(data ? JSON.stringify(data) : '');
}

export function respondStatic (req: any, res: any, resource: any, cachingOptions: any = {}) {
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

export function fetchBody (r): string {
    return promisifyStream(r);
}
