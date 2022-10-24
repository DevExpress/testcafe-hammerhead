import RequestFilterRule from '../request-hooks/request-filter-rule';
import RequestEventNames from './events/names';
import ConfigureResponseEventOptions from './events/configure-response-event-options';
import ResponseMock from './response-mock';
import { RequestInfo } from './events/info';
import RequestOptions from '../request-options';

export interface RequestEventListenerError {
    error: Error;
    methodName: string;
}

export interface RequestEventListeners {
    [RequestEventNames.onRequest]: Function;
    [RequestEventNames.onConfigureResponse]: Function;
    [RequestEventNames.onResponse]: Function;
}

export interface RequestEventListenersData {
    listeners: RequestEventListeners;
    errorHandler: (event: RequestEventListenerError) => void;
    rule: RequestFilterRule;
}

export interface HeaderData {
    name: string;
    value: string;
}

export interface ConfigureResponseEventData {
    opts: ConfigureResponseEventOptions;
    setHeaders: HeaderData[];
    removedHeaders: string[];
}

export interface RequestHookEventData {
    mocks: Map<string, ResponseMock>;
    configureResponse: Map<string, ConfigureResponseEventData>;
}

export interface RequestInfoInit {
    requestFilterRule: RequestFilterRule;
    // NOTE: legacy code. Remove '_' prefix before the next major release.
    _requestInfo: RequestInfo;
    reqOpts: RequestOptions;
    setMockFn: (responseEventId: string, mock: ResponseMock) => Promise<void>;
}
