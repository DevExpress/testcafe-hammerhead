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
}
