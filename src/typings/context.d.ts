import RequestFilterRule from '../request-pipeline/request-hooks/request-filter-rule';
import ConfigureResponseEventOptions from '../request-pipeline/request-hooks/events/configure-response-event-options';
import CachePolicy from 'http-cache-semantics';
import IncomingMessageLike from '../request-pipeline/incoming-message-like';

export interface OnResponseEventData {
    rule: RequestFilterRule;
    opts: ConfigureResponseEventOptions;
}

export interface ResponseCacheEntryBase {
    res: IncomingMessageLike;
    hitCount: number;
}

export interface ResponseCacheEntry extends ResponseCacheEntryBase {
    cachePolicy: CachePolicy;
}

export interface RequestCacheEntry {
    key: string;
    value: CachePolicy;
}
