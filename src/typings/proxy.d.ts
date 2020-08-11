export interface ServerInfo {
    hostname: string;
    port: number;
    crossDomainPort: number;
    protocol: string;
    domain: string;
}

export interface ServiceMessage {
    sessionId: string;
    cmd: string;
    disableResending?: boolean;
    allowRejecting?: boolean;
    referer?: string;
}

export interface StaticContent {
    content: string | Buffer;
    contentType: string;
    etag?: string;
    isShadowUIStylesheet?: boolean;
}
