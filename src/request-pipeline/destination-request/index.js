import http from 'http';
import https from 'https';
import OS from 'os-family';
import * as requestAgent from './agent';
import { EventEmitter } from 'events';
import { auth as requestWithAuth } from 'webauth';
import { assign as assignWindowsDomain } from './windows-domain';
import connectionResetGuard from '../connection-reset-guard';
import { MESSAGE, getText } from '../../messages';

// HACK: Ignore SSL auth. The rejectUnauthorized option in the https.request method
// doesn't work (see: https://github.com/mikeal/request/issues/418).
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Utils
function isDNSErr (err) {
    return err.message && err.message.indexOf('ENOTFOUND') > -1;
}

// DestinationRequest
export default class DestinationRequest extends EventEmitter {
    constructor (opts) {
        super();

        this.req               = null;
        this.hasResponse       = false;
        this.opts              = opts;
        this.isHttps           = opts.protocol === 'https:';
        this.protocolInterface = this.isHttps ? https : http;

        // NOTE: Ignore SSL auth.
        if (this.isHttps)
            opts.rejectUnauthorized = false;

        requestAgent.assign(this.opts);
        this._send();
    }

    _send () {
        connectionResetGuard(() => {
            var timeout = this.opts.isXhr ? DestinationRequest.XHR_TIMEOUT : DestinationRequest.TIMEOUT;

            this.req = this.protocolInterface.request(this.opts);

            this.req.on('response', res => this._onResponse(res));
            this.req.on('error', err => this._onError(err));
            this.req.setTimeout(timeout, () => this._onTimeout());

            this.req.write(this.opts.body);
            this.req.end();
        });
    }

    _onResponse (res) {
        this.hasResponse = true;

        if (res.statusCode === 401)
            this._sendWithCredentials(res);

        else
            this.emit('response', res);
    }

    async _sendWithCredentials (res) {
        if (this.opts.credentials) {
            if (OS.win)
                await assignWindowsDomain(this.opts.credentials);

            //TODO !!!
            requestWithAuth(this.opts, this.opts.credentials, [this.opts.body], response => {
                this.emit('response', response);
            }, this.isHttps, res);
        }
    }

    _onTimeout () {
        // NOTE: this handler is also called if we get an error response (for example, 404). So, we should check
        // for the response presence before raising the timeout error.
        if (!this.hasResponse) {
            this.req.abort();
            this.emit('fatalError', getText(MESSAGE.destRequestTimeout, this.opts.url));
        }
    }

    _onError (err) {
        if (requestAgent.shouldRegressHttps(err, this.opts)) {
            requestAgent.regressHttps(this.opts);
            this._send();
        }

        else if (isDNSErr(err))
            this.emit('fatalError', getText(MESSAGE.cantResolveUrl, this.opts.url));
        else
            this.emit('error');
    }
}

// NOTE: Exposed for testing purposes.
DestinationRequest.TIMEOUT     = 25 * 1000;
DestinationRequest.XHR_TIMEOUT = 60 * 1000;
