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
    _getIframePayloadScript (iframeWithoutSrc: boolean): string;
    _getPayloadScript (): string;
    handleFileDownload (): void;
}

declare module 'testcafe-hammerhead' {
    /** The Proxy class used to create a web-proxy **/
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

    /** Generates an URL friendly string identifier **/
    export function generateUniqueId(length?: number): string;
}
