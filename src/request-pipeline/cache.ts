import LRUCache from 'lru-cache';
import { ResponseCacheEntry, ResponseCacheEntryBase, RequestCacheEntry } from '../typings/context';
import RequestOptions from './request-options';
import { IncomingMessage } from 'http';
import CachePolicy from 'http-cache-semantics';
import RequestPipelineContext from "./context";
import { FileStream } from '../typings/session';
import IncomingMessageLike from './incoming-message-like';

const requestsCache = new LRUCache<string, ResponseCacheEntry>({
    max: 500 // Store 500 responses
});

function getCacheKey (requestOptions: RequestOptions): string {
    // NOTE: We don't use pair <method:url> as a cache key since we cache only GET requests
    return requestOptions.url;
}

// NOTE: export for testing purposes
export function shouldCache (ctx: RequestPipelineContext): boolean {
    return ctx.serverInfo.cacheRequests &&
        !ctx.isFileProtocol &&
        ctx.reqOpts.method === 'GET' &&
        (ctx.contentInfo.isCSS || ctx.contentInfo.isScript);
}

export function create (reqOptions: RequestOptions, res: IncomingMessage | IncomingMessageLike | FileStream): RequestCacheEntry | undefined {
    const cachePolicy = new CachePolicy(reqOptions, res);

    if (!cachePolicy.storable())
        return void 0;

    return {
        key:   getCacheKey(reqOptions),
        value: {
            cachePolicy,
            res:      IncomingMessageLike.createFrom(res as IncomingMessage),
            hitCount: 0
        }
    };
}

export function add (entry: RequestCacheEntry): void {
    const { key, value } = entry;

    requestsCache.set(key, value, value.cachePolicy.timeToLive());
}

export function getResponse (reqOptions: RequestOptions): ResponseCacheEntryBase | undefined {
    const key                  = getCacheKey(reqOptions);
    const cachedResponse       = requestsCache.get(key);

    if (!cachedResponse)
        return void 0;

    const { cachePolicy, res } = cachedResponse;

    if (!cachePolicy.satisfiesWithoutRevalidation(reqOptions))
        return void 0;

    res.headers = cachePolicy.responseHeaders();

    cachedResponse.hitCount++;

    return {
        res,
        hitCount: cachedResponse.hitCount
    };
}


