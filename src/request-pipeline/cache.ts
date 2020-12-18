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

function toLowerCase (val: string | string[]): string | string[] {
    if (Array.isArray(val))
        return val.map(item => item.toLowerCase());

    return val.toLowerCase();
}

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

// NOTE: export for testing purposes
export function prepareReqOptions (reqOptions: RequestOptions): RequestOptions {
    // NOTE: The 'http-cache-semantics' module requires header names in the low-case notation.
    const clonedReqOptions = Object.assign({}, reqOptions);
    const headerNames      = Object.keys(clonedReqOptions.headers);

    for (let i = 0; i < headerNames.length; i++) {
        const headerName          = headerNames[i];
        const lowerCaseHeaderName = headerName.toLocaleLowerCase();

        if (!headerNames.includes(lowerCaseHeaderName)) {
            clonedReqOptions.headers[lowerCaseHeaderName] = toLowerCase(clonedReqOptions.headers[headerName]);

            delete clonedReqOptions.headers[headerName];
        }
        else
            clonedReqOptions.headers[headerName] = toLowerCase(clonedReqOptions.headers[headerName]);
    }

    return clonedReqOptions;
}

export function create (reqOptions: RequestOptions, res: IncomingMessage | IncomingMessageLike | FileStream): RequestCacheEntry | undefined {
    const preparedReqOptions = prepareReqOptions(reqOptions);
    const cachePolicy        = new CachePolicy(preparedReqOptions, res);

    if (!cachePolicy.storable())
        return void 0;

    return {
        key:   getCacheKey(preparedReqOptions),
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
    const preparedReqOptions = prepareReqOptions(reqOptions);
    const key                = getCacheKey(preparedReqOptions);
    const cachedResponse     = requestsCache.get(key);

    if (!cachedResponse)
        return void 0;

    const { cachePolicy, res } = cachedResponse;

    if (!cachePolicy.satisfiesWithoutRevalidation(preparedReqOptions))
        return void 0;

    res.headers = cachePolicy.responseHeaders();

    cachedResponse.hitCount++;

    return {
        res,
        hitCount: cachedResponse.hitCount
    };
}


