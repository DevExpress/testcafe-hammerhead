import { ReadStream } from 'fs';
import { IncomingHttpHeaders, OutgoingHttpHeaders } from 'http';
import { RequestTimeout } from './proxy';

export interface WindowCredentials {
    domain?: string;
    workstation?: string;
}

export interface Credentials {
    username: string;
    password: string;
    domain?: string;
    workstation?: string;
}

export interface StoragesSnapshot {
    localStorage: string;
    sessionStorage: string;
}

export interface ExternalProxySettingsRaw {
    url: string;
    bypassRules?: string[];
}

export interface ExternalProxySettings {
    host: string;
    hostname: string;
    bypassRules?: string[];
    port?: string;
    proxyAuth?: string;
    authHeader?: string;
}

export interface FileStream extends ReadStream {
    statusCode: number;
    trailers: object;
    headers: IncomingHttpHeaders;
}

export interface RequestOptionsInit {
    method: string;
    url: string;
    protocol: string;
    hostname: string;
    host: string;
    port?: string | void;
    path: string;
    auth?: string | void;
    headers: OutgoingHttpHeaders;
    externalProxySettings?: ExternalProxySettings;
    credentials?: Credentials;
    body: Buffer;
    isAjax?: boolean;
    rawHeaders?: string[];
    requestId?: string;
    requestTimeout?: RequestTimeout;
    isWebSocket?: boolean;
    disableHttp2?: boolean;
    disableCrossDomain?: boolean;
}

