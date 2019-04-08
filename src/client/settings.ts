/*eslint-disable no-unused-vars*/
import { IHammerheadInitSettings } from '../typings/client';
/*eslint-enable no-unused-vars*/

class Settings {
    _settings: IHammerheadInitSettings;

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

    set (value: IHammerheadInitSettings) {
        this._settings = value;
    }

    get () {
        return this._settings;
    }
}

const settings = new Settings();

export default settings;
