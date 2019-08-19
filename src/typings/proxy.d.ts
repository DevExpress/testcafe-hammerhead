export interface ServerInfo {
    hostname: string,
    port: string,
    crossDomainPort: string,
    protocol: string,
    domain: string
}

export interface BaseServiceMessage {
    cmd: string;
}

export interface ServerServiceMessage extends BaseServiceMessage {
    sessionId: string;
}

export interface ConsoleMethodCalledServiceMessage extends BaseServiceMessage {
    meth: string;
    line: string;
}

export interface StaticContent {
    content: string | Buffer,
    contentType: string,
    etag?: string,
    isShadowUIStylesheet?: boolean
}
