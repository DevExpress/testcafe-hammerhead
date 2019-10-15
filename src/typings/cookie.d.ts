export interface CookieRecord {
    sid: string;
    key: string;
    domain: string;
    path: string;
    lastAccessed: Date;
    syncKey?: string;
    cookieStr?: string;
    value?: string;
    isServerSync?: boolean;
    isClientSync?: boolean;
    isWindowSync?: boolean;
}

export interface ParsedClientSyncCookie {
    outdated: CookieRecord[];
    actual: CookieRecord[];
}
