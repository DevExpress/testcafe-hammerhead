class WorkerNativeMethods {
    // Object
    objectToString = Object.prototype.toString;
    objectAssign = Object.assign;
    objectKeys = Object.keys;
    objectDefineProperty = Object.defineProperty;
    objectDefineProperties = Object.defineProperties;
    objectCreate = Object.create;
    objectIsExtensible = Object.isExtensible;
    objectIsFrozen = Object.isFrozen;
    objectGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
    objectHasOwnProperty = Object.hasOwnProperty;
    objectGetOwnPropertyNames = Object.getOwnPropertyNames;
    objectGetPrototypeOf = Object.getPrototypeOf;
    objectGetOwnPropertySymbols = Object.getOwnPropertySymbols;

    // XHR
    XMLHttpRequest = XMLHttpRequest;
    xhrAbort = XMLHttpRequest.prototype.abort;
    xhrOpen = XMLHttpRequest.prototype.open;
    xhrSend = XMLHttpRequest.prototype.send;
    xhrGetResponseHeader = XMLHttpRequest.prototype.getResponseHeader;
    xhrGetAllResponseHeaders = XMLHttpRequest.prototype.getAllResponseHeaders;
    xhrSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    xhrOverrideMimeType = XMLHttpRequest.prototype.overrideMimeType;
    xhrAddEventListener: XMLHttpRequest['addEventListener'];
    xhrRemoveEventListener: XMLHttpRequest['removeEventListener'];
    xhrDispatchEvent: XMLHttpRequest['dispatchEvent'];
    xhrStatusGetter: () => XMLHttpRequest['status'];
    xhrResponseURLGetter: (() => XMLHttpRequest['responseURL']) | undefined;

    URL = URL;

    constructor () {
        // NOTE: IE11 has no EventTarget so we should save "Event" methods separately
        const isEventTargetExists = typeof EventTarget !== 'undefined';
        const eventProtoForXhr = isEventTargetExists ? EventTarget.prototype : XMLHttpRequest.prototype;

        this.xhrAddEventListener    = eventProtoForXhr.addEventListener;
        this.xhrRemoveEventListener = eventProtoForXhr.removeEventListener;
        this.xhrDispatchEvent       = eventProtoForXhr.dispatchEvent;
        this.xhrStatusGetter        = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'status').get;

        const xhrResponseURLDescriptor = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseURL');

        // NOTE: IE doesn't support the 'responseURL' property
        if (xhrResponseURLDescriptor)
            this.xhrResponseURLGetter = xhrResponseURLDescriptor.get;
    }
}

export default new WorkerNativeMethods();
