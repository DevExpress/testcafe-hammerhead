/*eslint-disable no-unused-vars*/
import { HammerheadInitSettings } from '../typings/client';
/*eslint-enable no-unused-vars*/

class Settings {
    _settings: HammerheadInitSettings;

    constructor () {
        this._settings = {
            isFirstPageLoad:          true,
            sessionId:                '',
            forceProxySrcForImage:    false,
            crossDomainProxyPort:     '',
            referer:                  '',
            serviceMsgUrl:            '',
            iframeTaskScriptTemplate: '',
            cookie:                   ''
        };
    }

    set (value: HammerheadInitSettings) {
        this._settings = value;
    }

    get () {
        return this._settings;
    }
}

const settings = new Settings();

export default settings;
