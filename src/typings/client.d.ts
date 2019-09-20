export interface CheckByConditionOptions {
    win?: Window;
    checkConditionEveryMs?: number;
    abortAfterMs?: number;
}

export interface HammerheadInitSettings {
    isFirstPageLoad: boolean;
    sessionId: string;
    forceProxySrcForImage: boolean;
    crossDomainProxyPort: string;
    referer: string;
    serviceMsgUrl: string;
    iframeTaskScriptTemplate: string;
    cookie: string;
    allowMultipleWindows: boolean;
}

export interface ElementSandboxBeforeFormSubmitEvent {
    form: HTMLFormElement;
}

export interface ScrollState {
    left: number;
    top: number;
}

export interface DocumentCleanedEvent {
    window: Window;
    document: Document;
}

export interface UrlParameter {
    name: string;
    value: string;
}

