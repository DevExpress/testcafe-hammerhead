export interface ServerInfo {
    hostname: string,
    port: string,
    crossDomainPort: string,
    protocol: string,
    domain: string
}

export interface ServiceMessage {
    sessionId: string,
    [propName: string]: any;
}

export interface StaticContent {
    content: string | Buffer,
    contentType: string,
    etag?: string,
    isShadowUIStylesheet?: boolean
}
