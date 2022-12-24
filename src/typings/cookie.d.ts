export interface CookieRecord {
    sid: string;
    key: string;
    domain: string;
    path: string;
    expires: Date | 'Infinity';
    maxAge: number | 'Infinity' | '-Infinity' | null;
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
