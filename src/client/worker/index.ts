import Promise from 'pinkie';
import * as sharedUrlUtils from '../../utils/url';
import XhrSandbox from '../sandbox/xhr';
import FetchSandbox from '../sandbox/fetch';
import CookieSandbox from '../sandbox/cookie';
import settings from '../settings';
import overrideFetchEvent from './fetch-event';
import getGlobalContextInfo from '../utils/global-context-info';
import noop from '../utils/noop';
import nativeMethods from '../sandbox/native-methods';
import { SET_BLOB_WORKER_SETTINGS } from './set-settings-command';
import { forceLocation } from '../utils/destination-location';
import { stopPropagation } from '../utils/event';

class WorkerHammerhead {
    readonly xhr: XhrSandbox;
    readonly fetch: FetchSandbox;

    constructor () {
        const parsedLocation    = sharedUrlUtils.parseProxyUrl(location.toString());
        const cookieSandboxMock = { syncCookie: noop } as CookieSandbox;

        let waitHammerheadSettings: Promise<void> = null;

        // NOTE: the blob location case
        if (!parsedLocation) {
            waitHammerheadSettings = new Promise(resolve => {
                nativeMethods.windowAddEventListener.call(self, 'message', function onMessage (e: MessageEvent) {
                    const data = nativeMethods.messageEventDataGetter.call(e);

                    if (data.cmd !== SET_BLOB_WORKER_SETTINGS)
                        return;

                    WorkerHammerhead._setProxySettings(data.sessionId, data.windowId);
                    forceLocation(data.origin); // eslint-disable-line no-restricted-properties

                    nativeMethods.windowRemoveEventListener.call(self, 'message', onMessage);
                    stopPropagation(e);
                    resolve();
                });
            });
        }
        else
            WorkerHammerhead._setProxySettings(parsedLocation.sessionId, parsedLocation.windowId);

        this.fetch = new FetchSandbox(cookieSandboxMock, waitHammerheadSettings);
        this.fetch.attach(self);

        if (!getGlobalContextInfo().isServiceWorker) {
            this.xhr = new XhrSandbox(cookieSandboxMock, waitHammerheadSettings);
            this.xhr.attach(self);
        }
        else
            overrideFetchEvent();
    }

    private static _setProxySettings(sessionId: string, windowId?: string) {
        const currentSettings = settings.get();

        currentSettings.sessionId = sessionId;

        if (windowId)
            currentSettings.windowId  = windowId;

        settings.set(currentSettings);
    }
}

export default new WorkerHammerhead();
