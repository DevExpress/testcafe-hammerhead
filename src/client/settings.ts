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
            iframeTaskScriptTemplate: '',
            cookie:                   '',
            allowMultipleWindows:     false,
            isRecordMode:             false,
            windowId:                 '',
            nativeAutomation:         false,
            disableCrossDomain:       false,
        };
    }

    set (value: HammerheadInitSettings): void {
        this._settings = value;
    }

    get (): HammerheadInitSettings {
        return this._settings;
    }

    get nativeAutomation () {
        return this._settings.nativeAutomation;
    }
}

const settings = new Settings();

export default settings;
