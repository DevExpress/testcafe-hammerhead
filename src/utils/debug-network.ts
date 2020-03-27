import RequestPipelineContext from '../request-pipeline/context';
import { OutgoingHttpHeaders, IncomingMessage } from 'http';
import RequestOptions from '../request-pipeline/request-options';
import { ServiceMessage } from '../typings/proxy';

function noop () {
}

enum FilteredResourceStatus {
    exceptHeaders = 0,
    confirmed     = 1
}

type HeadersFilterFunc = (headers: OutgoingHttpHeaders) => boolean;
type HeadersFilterLog = (headers: OutgoingHttpHeaders) => OutgoingHttpHeaders;

let methodFilter: (method: string) => boolean;
let urlFilter: (url: string) => boolean;
let serviceMessageFilter: (cmd: string) => boolean;
let proxyRequestHeadersFilter: HeadersFilterFunc;
let proxyResponseHeadersFilter: HeadersFilterFunc;
let destinationRequestHeadersFilter: HeadersFilterFunc;
let destinationResponseHeadersFilter: HeadersFilterFunc;

let proxyRequestHeadersFilterLog: HeadersFilterLog;
let proxyResponseHeadersFilterLog: HeadersFilterLog;
let destinationRequestHeadersFilterLog: HeadersFilterLog;
let destinationResponseHeadersFilterLog: HeadersFilterLog;


interface HeadersFilterSettings {
    filter?: '*' | { only: string | string[] };
    log?: 'none' | '*' | { only: string | string[] };
}

interface ResourceHeadersFilterSettings {
    request?: 'none' | '*' | HeadersFilterSettings;
    response?: 'none' | '*' | HeadersFilterSettings;
}

interface SystemHeadersFilterSettings {
    proxy?: 'none' | '*' | ResourceHeadersFilterSettings;
    destination?: 'none' | '*' | ResourceHeadersFilterSettings;
}

interface DebugNetworkSettings {
    method?: '*' | string | string[];
    url?: '*' | string | string[];
    headers?: '*' | 'none' | SystemHeadersFilterSettings;
    service?: 'none' | '*' | string | string[];
    file?: string
    //body?: 'none' | '*' | { start: number; end: number; limit: number; };
}

const isDebugMode = true;
const debugNetworkSettings: DebugNetworkSettings = {
    method:  'get',
    url:     'example',
    headers: {
        proxy:       {
            request: { filter: { only: 'hghggh' } }
        },
        destination: {
            response: {
                filter: {
                    only: 'content-encoding'
                }
            }
        }
    },
    service: 'click'
};


function processFilterSettings (settings: DebugNetworkSettings) {
    processMethodFilter(settings.method || '*');
    processUrlFilter(settings.url || '*');
    parseHeadersFilter(settings.headers || '*');
    parseServiceFilter(settings.service || 'none');
}

processFilterSettings(debugNetworkSettings);

function processMethodFilter (value: string | string[]) {
    if (value === '*')
        methodFilter = () => true;
    else if (typeof value === 'string') {
        value = value.toUpperCase();

        methodFilter = method => method === value;
    }
    else {
        const values = value.map(v => v.toUpperCase());

        methodFilter = method => values.includes(method);
    }
}

function processUrlFilter (value: string | string[]) {
    if (value === '*')
        urlFilter = () => true;
    else if (typeof value === 'string')
        urlFilter = url => url.includes(value);
    else
        urlFilter = url => value.some(v => url.includes(v));
}

function expandHeadersSettings (value: string | HeadersFilterSettings): HeadersFilterSettings {
    if (value === '*')
        value = {
            log:    '*',
            filter: '*'
        };
    else if (value === 'none')
        value = {
            log:    'none',
            filter: '*'
        };

    const settings = value as HeadersFilterSettings;

    if (!settings.log)
        settings.log = '*';
    else if (!settings.filter)
        settings.filter = '*';

    return settings;
}

function expandResourceHeadersSettings (value: string | ResourceHeadersFilterSettings): ResourceHeadersFilterSettings {
    if (value === '*')
        value = {
            request:  '*',
            response: '*'
        };
    else if (value === 'none')
        value = {
            request:  'none',
            response: 'none'
        };

    const settings = value as ResourceHeadersFilterSettings;

    if (!settings.request)
        settings.request = '*';
    else if (!settings.response)
        settings.response = '*';

    settings.request = expandHeadersSettings(settings.request);
    settings.response = expandHeadersSettings(settings.response);

    return settings;
}

function expandSystemHeadersSettings (value: string | SystemHeadersFilterSettings): SystemHeadersFilterSettings {
    if (value === '*')
        value = {
            proxy:       '*',
            destination: '*'
        };
    else if (value === 'none')
        value = {
            proxy:       'none',
            destination: 'none'
        };

    const settings = value as SystemHeadersFilterSettings;

    if (!settings.proxy)
        settings.proxy = '*';
    else if (!settings.destination)
        settings.destination = '*';

    settings.proxy = expandResourceHeadersSettings(settings.proxy);
    settings.destination = expandResourceHeadersSettings(settings.destination);

    return settings;
}

function createHeadersFilterFunction (value: HeadersFilterSettings['filter']): HeadersFilterFunc {
    if (value === '*')
        return () => true;
    else if ('only' in value) {
        const onlyFilter = value.only;

        if (typeof onlyFilter === 'string')
            return headers => !!headers[onlyFilter];
        else
            return headers => onlyFilter.some(header => !!headers[header]);
    }
    else
        return () => true;
}

function createHeadersFilterLogFunction (value: HeadersFilterSettings['log']): HeadersFilterLog {
    if (value === '*')
        return headers => headers;
    else if (value === 'none')
        return () => ({});
    else if ('only' in value) {
        const onlyFilter = value.only;

        if (typeof onlyFilter === 'string')
            return headers => headers[onlyFilter] ? { [onlyFilter]: headers[onlyFilter] } : {};
        else {
            return headers => onlyFilter.reduce((newHeaders, header) => {
                if (headers[header])
                    newHeaders[header] = headers[header];

                return newHeaders;
            }, {});
        }
    }
    else
        return headers => headers;
}

function parseHeadersFilter (value: string | SystemHeadersFilterSettings) {
    value = expandSystemHeadersSettings(value);

    const proxyHeadersSettings = value.proxy as ResourceHeadersFilterSettings;
    const destinationHeadersSettings = value.destination as ResourceHeadersFilterSettings;

    proxyRequestHeadersFilter = createHeadersFilterFunction((proxyHeadersSettings.request as HeadersFilterSettings).filter);
    proxyResponseHeadersFilter = createHeadersFilterFunction((proxyHeadersSettings.response as HeadersFilterSettings).filter);
    destinationRequestHeadersFilter = createHeadersFilterFunction((destinationHeadersSettings.request as HeadersFilterSettings).filter);
    destinationResponseHeadersFilter = createHeadersFilterFunction((destinationHeadersSettings.response as HeadersFilterSettings).filter);

    proxyRequestHeadersFilterLog = createHeadersFilterLogFunction((proxyHeadersSettings.request as HeadersFilterSettings).log);
    proxyResponseHeadersFilterLog = createHeadersFilterLogFunction((proxyHeadersSettings.response as HeadersFilterSettings).log);
    destinationRequestHeadersFilterLog = createHeadersFilterLogFunction((destinationHeadersSettings.request as HeadersFilterSettings).log);
    destinationResponseHeadersFilterLog = createHeadersFilterLogFunction((destinationHeadersSettings.response as HeadersFilterSettings).log);
}

function parseServiceFilter (value: string | string[]) {
    if (value === 'none')
        serviceMessageFilter = () => false;
    else if (value === '*')
        serviceMessageFilter = () => true;
    else if (typeof value === 'string')
        serviceMessageFilter = cmd => cmd === value;
    else
        serviceMessageFilter = cmd => value.includes(cmd);
}


const filteredIds: Map<string, FilteredResourceStatus> = new Map();


function proxyError (ctx: RequestPipelineContext, err: Error) {
    filteredIds.delete(ctx.requestId);

    console.dir({
        label:     'proxy error',
        requestId: ctx.requestId,
        url:       ctx.req.url,
        method:    ctx.req.method,
        message:   err.message,
        stack:     err.stack
    });
}

function destinationError (opts: RequestOptions, err: Error) {
    filteredIds.delete(opts.requestId);

    console.dir({
        label:     'destination error',
        requestId: opts.requestId,
        url:       opts.url,
        method:    opts.method,
        message:   err.message,
        stack:     err.stack
    });
}

function destinationTimeout (opts: RequestOptions, timeout: number) {
    filteredIds.delete(opts.requestId);

    console.dir({
        label:     'destination timeout',
        requestId: opts.requestId,
        url:       opts.url,
        method:    opts.method,
        timeout:   timeout
    });
}

function proxyRequest (ctx: RequestPipelineContext) {
    if (!methodFilter(ctx.req.method) || !urlFilter(ctx.req.url))
        return;

    filteredIds.set(ctx.requestId, FilteredResourceStatus.exceptHeaders);

    if (!proxyRequestHeadersFilter(ctx.req.headers))
        return;

    filteredIds.set(ctx.requestId, FilteredResourceStatus.confirmed);

    console.dir({
        label:     'proxy request',
        requestId: ctx.requestId,
        url:       ctx.req.url,
        method:    ctx.req.method,
        headers:   proxyRequestHeadersFilterLog(ctx.req.headers)
    });
}

function destinationRequest (opts: RequestOptions) {
    if (!filteredIds.has(opts.requestId))
        return;

    if (filteredIds.get(opts.requestId) === FilteredResourceStatus.exceptHeaders) {
        if (!destinationRequestHeadersFilter(opts.headers))
            return;

        filteredIds.set(opts.requestId, FilteredResourceStatus.confirmed);
    }

    console.dir({
        label:     'destination request',
        requestId: opts.requestId,
        url:       opts.url,
        method:    opts.method,
        headers:   destinationRequestHeadersFilterLog(opts.headers)
    });
}

function destinationResponse (requestId: string, res: IncomingMessage) {
    if (!filteredIds.has(requestId))
        return;

    if (filteredIds.get(requestId) === FilteredResourceStatus.exceptHeaders) {
        if (!destinationResponseHeadersFilter(res.headers))
            return;

        filteredIds.set(requestId, FilteredResourceStatus.confirmed);
    }

    console.dir({
        label:      'destination response',
        requestId:  requestId,
        statusCode: res.statusCode,
        headers:    destinationResponseHeadersFilterLog(res.headers)
    });
}

function proxyResponse (ctx: RequestPipelineContext, headers: OutgoingHttpHeaders) {
    if (!filteredIds.get(ctx.requestId) || !proxyResponseHeadersFilter(headers))
        return;

    filteredIds.delete(ctx.requestId);

    console.dir({
        label:      'proxy response',
        requestId:  ctx.requestId,
        statusCode: ctx.destRes.statusCode,
        headers:    proxyResponseHeadersFilterLog(headers)
    });
}

function serviceMessage (msg: ServiceMessage, result: object) {
    if (!serviceMessageFilter(msg.cmd))
        return;

    console.dir({
        label: 'service message',
        msg,
        result
    });
}

function serviceMessageError (msg: ServiceMessage, err: Error) {
    if (!serviceMessageFilter(msg.cmd))
        return;

    console.dir({
        label:    'service message',
        msg,
        errorMsg: err.message,
        stack:    err.stack
    });
}

export const proxyErrorLogger = isDebugMode ? proxyError : noop;
export const destinationErrorLogger = isDebugMode ? destinationError : noop;
export const destinationTimeoutLogger = isDebugMode ? destinationTimeout : noop;
export const proxyRequestLogger = isDebugMode ? proxyRequest : noop;
export const destinationRequestLogger = isDebugMode ? destinationRequest : noop;
export const destinationResponseLogger = isDebugMode ? destinationResponse : noop;
export const proxyResponseLogger = isDebugMode ? proxyResponse : noop;
export const serviceMessageLogger = isDebugMode ? serviceMessage : noop;
export const serviceMessageErrorLogger = isDebugMode ? serviceMessageError : noop;
