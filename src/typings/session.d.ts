/*eslint-disable no-unused-vars*/
import { ReadStream } from 'fs';
/*eslint-enable no-unused-vars*/

export interface Credentials {
    username: string,
    password: string,
    domain?: string,
    workstation?: string
}

export interface StoragesSnapshot {
    localStorage: string;
    sessionStorage: string;
}

export interface ExternalProxySettingsRaw {
    url: string,
    bypassRules?: Array<string>
}

export interface ExternalProxySettings {
    host: string,
    hostname: string,
    bypassRules?: Array<string>,
    port?: string,
    proxyAuth?: string,
    authHeader?: string
}

export interface FileStream extends ReadStream {
    statusCode: number;
    trailers: object;
    headers: { [name: string]: string };
}
