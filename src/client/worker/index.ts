import * as sharedUrlUtils from '../../utils/url';
import XhrSandbox from '../sandbox/xhr';
import FetchSandbox from '../sandbox/fetch';
import CookieSandbox from '../sandbox/cookie';
import settings from '../settings';

class WorkerHammerhead {
    readonly xhr: XhrSandbox;
    readonly fetch: FetchSandbox;

    constructor () {
        const parsedLocation    = sharedUrlUtils.parseProxyUrl(location.toString());
        const currentSettings   = settings.get();
        const cookieSandboxMock = { syncCookie: () => {} } as CookieSandbox;

        currentSettings.sessionId = parsedLocation && parsedLocation.sessionId;
        currentSettings.windowId  = parsedLocation && parsedLocation.windowId;

        settings.set(currentSettings);

        this.fetch = new FetchSandbox(cookieSandboxMock);
        this.fetch.attach(self);

        // @ts-ignore
        if (self.XMLHttpRequest) {
            this.xhr = new XhrSandbox(cookieSandboxMock);
            this.xhr.attach(self);
        }
    }
}

export default new WorkerHammerhead();
