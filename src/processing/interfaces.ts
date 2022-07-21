export interface MetaInfo {
    httpEquiv: string | null;
    content: string | null;
    charset: string | null;
}

export interface PageInjectableResources {
    stylesheets: string[];
    scripts: string[];
    embeddedScripts: string[];
}
