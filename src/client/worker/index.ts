import { parseProxyUrl } from '../../utils/url';
import { getProxyUrl, stringifyResourceType } from '../utils/url';
import XhrSandbox from '../sandbox/xhr';
import FetchSandbox from '../sandbox/fetch';
import CookieSandbox from '../sandbox/cookie';
import settings from '../settings';
import overrideFetchEvent from './fetch-event';
import globalContextInfo from '../utils/global-context-info';
import noop from '../utils/noop';
import nativeMethods from '../sandbox/native-methods';
import { forceLocation } from '../utils/destination-location';
import { overrideFunction } from '../utils/overriding';
import INSTRUCTION from '../../processing/script/instruction';

class WorkerHammerhead {
    readonly xhr: XhrSandbox;
    readonly fetch: FetchSandbox;

    constructor () {
        const parsedLocation    = parseProxyUrl(location.toString());
        const cookieSandboxMock = { syncCookie: noop } as CookieSandbox;

        // NOTE: the blob location case
        if (!parsedLocation)
            this._getBlobSettings();
        else
            WorkerHammerhead._setProxySettings(parsedLocation.sessionId, parsedLocation.windowId);

        this.fetch = new FetchSandbox(cookieSandboxMock);
        this.fetch.attach(self);

        WorkerHammerhead._overrideImportScripts();

        if (!globalContextInfo.isServiceWorker) {
            this.xhr = new XhrSandbox(cookieSandboxMock);
            this.xhr.attach(self);
        }
        else
            overrideFetchEvent();
    }

    private static _setProxySettings (sessionId: string, windowId?: string) {
        const currentSettings = settings.get();

        currentSettings.sessionId = sessionId;
        currentSettings.windowId  = windowId;

        settings.set(currentSettings);
    }

    private static _overrideImportScripts () {
        // @ts-ignore
        overrideFunction(self, 'importScripts', (...urls: any[]) => {
            for (let i = 0; i < urls.length; i++)
                urls[i] = getProxyUrl(urls[i], { resourceType: stringifyResourceType({ isScript: true }) });

            return nativeMethods.importScripts.apply(self, urls);
        });
    }

    private _getBlobSettings () {
        const data = self[INSTRUCTION.getWorkerSettings]();

        WorkerHammerhead._setProxySettings(data.sessionId, data.windowId);
        forceLocation(data.origin); // eslint-disable-line no-restricted-properties
    }
}

export default new WorkerHammerhead();
