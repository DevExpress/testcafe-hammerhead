export interface MetaInfo {
    httpEquiv: string | null;
    content: string | null;
    charset: string | null;
}

export interface PageInjectableResources {
    storages: string | null;
    stylesheets: string[];
    scripts: string[];
    embeddedScripts: string[];
}

export interface PageRestoreStoragesOptions {
    host: string;
    sessionId: string;
}
