interface StaticContent {
    content: string | Buffer,
    contentType: string,
    etag?: string,
    isShadowUIStylesheet?: boolean
}

interface ExternalProxySettingsRaw {
    url: string,
    bypassRules?: string[]
}

interface Session {
    getIframePayloadScript (iframeWithoutSrc: boolean): Promise<string>;
    getPayloadScript (): Promise<string>;
    handleFileDownload (): void;
}

declare module 'testcafe-hammerhead' {
    import { IncomingHttpHeaders } from 'http';

    /** The Proxy class is used to create a web-proxy **/
    export class Proxy {
        /** Creates a web proxy instance **/
        constructor ();

        /**  Close the proxy instance */
        close (): void;

        /** Opens a new test run session **/
        openSession(url: string, session: Session, externalProxySettings: ExternalProxySettingsRaw): string;

        /** Closes the specified test run session **/
        closeSession (session: Session): void;

        /** Register a new route for the GET HTTP method **/
        GET (route: string, handler: StaticContent | Function): void;

        /** Register a new route for the POST HTTP method **/
        POST (route: string, handler: StaticContent | Function): void;

        /** Unregister the route **/
        unRegisterRoute (route: string, method: string): void;
    }

    /** The RequestFilterRule class is used to create URL filtering rules for request hook **/
    export class RequestFilterRule {
        /** Creates a request filter rule instance **/
        constructor (options: any);

        /** Returns the value that accepts any request  **/
        static ANY: RequestFilterRule;

        /** Check whether the specified RequestFilterRule instance accepts any request **/
        static isANY (instance: any): boolean;
    }

    /** The StateSnapshot class is used to create page state snapshot **/
    export class StateSnapshot {
        /** Creates a empty page state snapshot **/
        static empty (): StateSnapshot;
    }

    /** The ConfigureResponseEventOptions contains options to set up ResponseEvent **/
    export class ConfigureResponseEventOptions {
        /** Creates an instance of ConfigureResponseEventOptions **/
        constructor(includeHeaders: boolean, includeBody: boolean);

        /** Specified whether to include headers to ResponseEvent **/
        includeHeaders: boolean;

        /** Specified whether to include body to Response **/
        includeBody: boolean;
    }

    /** The ConfigureResponseEvent is used to set up the ResponseEvent **/
    export class ConfigureResponseEvent {
        /** The options to configure ResponseEvent **/
        opts: ConfigureResponseEventOptions;
    }

    /** The RequestInfo class contains information about query request **/
    export class RequestInfo {
        /** Request unique identifier **/
        requestId: string;

        /** Session unique identifier **/
        sessionId: string;

        /** The user agent of the query request **/
        userAgent: string;

        /** The url of the query request **/
        url: string;

        /** The method of the query request **/
        method: string;

        /** The headers of the query request **/
        headers: IncomingHttpHeaders;

        /** The body of the query request **/
        body: Buffer;
    }

    /** The RequestEvent describes the request part of the query captured with request hook **/
    export class RequestEvent {
        /** The information of the query request **/
        _requestInfo: RequestInfo;

        /** The filter rule for the query **/
        _requestFilterRule: RequestFilterRule;

        /** Set up the mock for the query response **/
        setMock(mock: ResponseMock): void;
    }

    /** The ResponseEvent describes the response part of the query captured with request hook **/
    export class ResponseEvent {
        /** The filter rule for the query **/
        _requestFilterRule: RequestFilterRule;

        /** Request unique identifier **/
        requestId: string;

        /** The status code of the query **/
        statusCode: number;

        /** The headers of the query response **/
        headers: IncomingHttpHeaders;

        /** The body of the query response **/
        body: Buffer;
    }

    /** The ResponseMock class is used to construct the response of the mocked request **/
    export class ResponseMock {
        /** Creates a ResponseMock instance **/
        constructor(body: string | Function, statusCode?: number, headers?: object);
    }

    /** Generates an URL friendly string identifier **/
    export function generateUniqueId(length?: number): string;

    /** Inject into specified text the service scripts instructions **/
    export function processScript(src: string, withHeader?: boolean, wrapLastExprWithProcessHtml?: boolean, resolver?: Function): string;

    /** Check whether specified code contains the service script instructions **/
    export function isScriptProcessed (code: string): boolean;

    /** The URL of the service blank page **/
    export const SPECIAL_BLANK_PAGE: string;

    /** The URL of the service error page **/
    export const SPECIAL_ERROR_PAGE: string;

    /** The internal status code indicating to failed same origin check **/
    export const SAME_ORIGIN_CHECK_FAILED_STATUS_CODE: number;
}
