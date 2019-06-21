export interface ServerInfo {
    hostname: string,
    port: string,
    crossDomainPort: string,
    protocol: string,
    domain: string,
    wsOrigin: string
}

export interface ServiceMessage {
    sessionId: string;
    cmd: string;
    allowRejecting?: boolean;
    id: number;
}

export interface StaticContent {
    content: string | Buffer,
    contentType: string,
    etag?: string,
    isShadowUIStylesheet?: boolean
}
