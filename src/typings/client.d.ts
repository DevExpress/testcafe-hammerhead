import StorageWrapper from '../client/sandbox/storages/wrapper';

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
    transportWorkerUrl: string;
    iframeTaskScriptTemplate: string;
    cookie: string;
    allowMultipleWindows: boolean;
    isRecordMode: boolean;
    windowId: string;
    nativeAutomation: boolean;
    disableCrossDomain: boolean;
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

export interface OpenedWindowInfo {
    windowId: string;
    wnd: Window;
}

interface StorageProxy {
    unwrapProxy: () => StorageWrapper;
    // NOTE: This property is necessary, because 'StorageWrapper' is not assignable to 'StorageProxy'.
    nonExistentProperty: void;
}

interface HammerheadStorageEventInit extends Omit<StorageEventInit, 'storageArea'> {
    storageArea: StorageProxy;
}
