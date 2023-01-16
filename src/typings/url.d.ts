import { Credentials } from '../utils/url';

export interface ResourceType {
    isIframe?: boolean;
    isForm?: boolean;
    isScript?: boolean;
    isEventSource?: boolean;
    isHtmlImport?: boolean;
    isWebSocket?: boolean;
    isServiceWorker?: boolean;
    isAjax?: boolean;
    isObject?: boolean;
}

export interface ParsedUrl {
    protocol?: string;
    host?: string;
    hostname?: string;
    port?: string;
    partAfterHost?: string;
    auth?: string;
}

export interface RequestDescriptor {
    sessionId: string;
    resourceType: string | null;
    charset?: string;
    reqOrigin?: string;
    windowId?: string;
    credentials?: Credentials;
}

export interface ParsedProxyUrl {
    destUrl: string;
    destResourceInfo: ParsedUrl;
    partAfterHost: string;
    sessionId: string;
    resourceType: string;
    charset?: string;
    reqOrigin?: string;
    windowId?: string;
    credentials?: Credentials,
    proxy: {
        hostname: string;
        port: string;
    };
}

export interface ProxyUrlOptions {
    sessionId: string;
    resourceType?: string;
    charset?: string;
    reqOrigin?: string;
    proxyProtocol: string;
    proxyHostname: string;
    proxyPort: string;
    windowId?: string;
    credentials?: Credentials;
    isUrlsSet?: boolean;
    doc?: Document;
}
