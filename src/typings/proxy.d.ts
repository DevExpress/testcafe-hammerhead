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

interface RouterOptions {
    staticContentCaching?: object;
}

interface RequestTimeout {
    page?: number;
    ajax?: number;
}

interface ProxyOptions extends RouterOptions {
    ssl?: object;
    developmentMode?: boolean;
}
