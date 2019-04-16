export interface ICheckByConditionOptions {
    win?: Window;
    checkConditionEveryMs?: number;
    abortAfterMs?: number;
}

export interface IHammerheadInitSettings {
    isFirstPageLoad: boolean;
    sessionId: string;
    forceProxySrcForImage: boolean;
    crossDomainProxyPort: string;
    referer: string;
    serviceMsgUrl: string;
    iframeTaskScriptTemplate: string;
    cookie: string;
}

export interface ElementSandboxBeforeFormSubmitEvent {
    form: HTMLFormElement;
}

export interface ScrollState {
    left: number;
    top: number;
}

