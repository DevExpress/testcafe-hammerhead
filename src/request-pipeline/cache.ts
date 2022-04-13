import LRUCache from 'lru-cache';

import {
    ResponseCacheEntry,
    ResponseCacheEntryBase,
    RequestCacheEntry,
} from '../typings/context';

import RequestOptions from './request-options';
import { IncomingMessage } from 'http';
import CachePolicy from 'http-cache-semantics';
import RequestPipelineContext, { DestinationResponse } from './context';
import IncomingMessageLike from './incoming-message-like';


const requestsCache = new LRUCache<string, ResponseCacheEntry>({
    max:    50 * 1024 * 1024, // Max cache size is 50 MBytes.
    length: responseCacheEntry => {
        // NOTE: Length is resource content size.
        // 1 character is 1 bite.
        return responseCacheEntry.res.getBody()?.length || 0;
    },
});

function getCacheKey (requestOptions: RequestOptions): string {
    // NOTE: We don't use pair <method:url> as a cache key since we cache only GET requests
    return requestOptions.url;
}

// NOTE: export for testing purposes
export function shouldCache (ctx: RequestPipelineContext): boolean {
    return ctx.serverInfo.cacheRequests && !ctx.isFileProtocol && ctx.reqOpts.method === 'GET' &&
        (ctx.contentInfo.isCSS || ctx.contentInfo.isScript || !ctx.contentInfo.requireProcessing);
}

export function create (reqOptions: RequestOptions, res: DestinationResponse): RequestCacheEntry | undefined {
    const cachePolicy = new CachePolicy(reqOptions, res);

    if (!cachePolicy.storable())
        return void 0;

    return {
        key:   getCacheKey(reqOptions),
        value: {
            cachePolicy,
            res:      IncomingMessageLike.createFrom(res as IncomingMessage),
            hitCount: 0,
        },
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
        hitCount: cachedResponse.hitCount,
    };
}

// NOTE: Maximum size for the non processed resource is 5 Mb
export const MAX_SIZE_FOR_NON_PROCESSED_RESOURCE = 5 * 1024 * 1024;


