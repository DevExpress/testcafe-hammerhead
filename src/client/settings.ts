import { HammerheadInitSettings } from '../typings/client';

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
            transportWorkerUrl:       '',
            workerHammerheadUrl:      '',
            iframeTaskScriptTemplate: '',
            cookie:                   '',
            allowMultipleWindows:     false,
            isRecordMode:             false,
            windowId:                 ''
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
