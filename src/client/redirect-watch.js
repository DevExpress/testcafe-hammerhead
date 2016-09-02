import EventEmiter from './utils/event-emitter';
import transport from './transport';
import COMMAND from '../session/command';
import * as browserUtils from './utils/browser';

export default class RedirectWatch extends EventEmiter {
    constructor () {
        super();

        this.REDIRECT_DETECTED_EVENT = 'hammerhead|event|redirect-detected';

        if (!window.name)
            window.name = Date.now();
    }

    static _getMessage () {
        return {
            cmd: COMMAND.waitRedirect,

            data: {
                referer:            location.toString(),
                window:             window.name,
                conformationNeeded: !browserUtils.isIOS && !browserUtils.isMacPlatform
            },

            disableResending: true
        };
    }

    _sendConfirmationMessage () {
        var msg = RedirectWatch._getMessage();

        msg.data.confirmation = true;
        transport.asyncServiceMsg(msg);
    }

    _sendRequestMessage () {
        var msg = RedirectWatch._getMessage();

        transport.asyncServiceMsgInternal(msg, data => {
            if (data === 'detected') {
                this.emit(this.REDIRECT_DETECTED_EVENT, data);
                this._sendConfirmationMessage();
            }
            else
                this._sendRequestMessage();
        },

        () => {
            console.log('1');
            this.emit(this.REDIRECT_DETECTED_EVENT);
            this._sendConfirmationMessage();
        });
    }

    init () {
        this._sendRequestMessage();
    }
}
