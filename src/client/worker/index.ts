import * as sharedUrlUtils from '../../utils/url';
import XhrSandbox from '../sandbox/xhr';
import CookieSandbox from '../sandbox/cookie';
import settings from '../settings';

class WorkerHammerhead {
    xhr: XhrSandbox;

    constructor () {
        const parsedLocation  = sharedUrlUtils.parseProxyUrl(location.toString());
        const currentSettings = settings.get();

        currentSettings.sessionId = parsedLocation && parsedLocation.sessionId;
        currentSettings.windowId  = parsedLocation && parsedLocation.windowId;

        settings.set(currentSettings);

        this.xhr = new XhrSandbox({ syncCookie: () => {} } as CookieSandbox);
        this.xhr.attach(self);
    }
}

export default new WorkerHammerhead();
