export interface ICheckByConditionOptions {
    win?: Window;
    checkConditionEveryMs?: number;
    abortAfterMs?: number;
}

export interface IHammerheadInitSettings {
    isFirstPageLoad: boolean;
    sessionId: string;
    forceProxySrcForImage: boolean;
}
