import Promise from 'pinkie';
import SandboxBase from '../sandbox/base';

export default class SandboxBaseWithDelayedSettings extends SandboxBase {
    constructor (private _waitHammerheadSettings?: Promise<void>) {
        super();

        if (_waitHammerheadSettings) {
            _waitHammerheadSettings.then(() => {
                this._waitHammerheadSettings = null;
            });
        }
    }

    gettingSettingInProgress () {
        return !!this._waitHammerheadSettings;
    }

    delayUntilGetSettings (action): Promise<void> {
        return this._waitHammerheadSettings.then(action);
    }
}
