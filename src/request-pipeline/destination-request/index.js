import http from 'http';
import https from 'https';
import * as requestAgent from './agent';
import { EventEmitter } from 'events';
import { getAuthInfo, addCredentials } from 'webauth';
import connectionResetGuard from '../connection-reset-guard';
import { MESSAGE, getText } from '../../messages';

// HACK: Ignore SSL auth. The rejectUnauthorized option in the https.request method
// doesn't work (see: https://github.com/mikeal/request/issues/418).
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';


// DestinationRequest
export default class DestinationRequest extends EventEmitter {
    constructor (opts) {
        super();

        this.req               = null;
        this.hasResponse       = false;
        this.credentialsSent   = false;
        this.aborted           = false;
        this.opts              = opts;
        this.isHttps           = opts.protocol === 'https:';
        this.protocolInterface = this.isHttps ? https : http;

        // NOTE: Ignore SSL auth.
        if (this.isHttps)
            opts.rejectUnauthorized = false;

        requestAgent.assign(this.opts);
        this._send();
    }

    _send (waitForData) {
        connectionResetGuard(() => {
            var timeout = this.opts.isXhr ? DestinationRequest.XHR_TIMEOUT : DestinationRequest.TIMEOUT;

            this.req = this.protocolInterface.request(this.opts, res => {
                if (waitForData) {
                    res.on('data', () => void 0);
                    res.once('end', () => this._onResponse(res));
                }
            });

            if (!waitForData)
                this.req.on('response', res => this._onResponse(res));

            this.req.on('error', err => this._onError(err));
            this.req.setTimeout(timeout, () => this._onTimeout());
            this.req.write(this.opts.body);
            this.req.end();
        });
    }

    _shouldResendWithCredentials (res) {
        if (res.statusCode === 401 && this.opts.credentials) {
            var authInfo = getAuthInfo(res);

            // NOTE: If we get 401 status code after credentials are sent, we should stop trying to authenticate.
            if (!authInfo.isChallengeMessage && this.credentialsSent)
                return false;

            return authInfo.canAuthorize;
        }

        return false;
    }

    _onResponse (res) {
        if (this._shouldResendWithCredentials(res))
            this._resendWithCredentials(res);
        else {
            this.hasResponse = true;
            this.emit('response', res);
        }
    }

    async _resendWithCredentials (res) {
        addCredentials(this.opts.credentials, this.opts, res, this.protocolInterface);
        this.credentialsSent = true;

        var authInfo = getAuthInfo(res);

        // NOTE: NTLM authentication requires using the same socket for the "negotiate" and "authenticate" requests.
        // So, before sending the "authenticate" message, we should wait for data from the "challenge" response. It
        // will mean that the socket is free.
        this._send(!authInfo.isChallengeMessage && authInfo.method.toLowerCase() === 'ntlm');
    }

    _abort () {
        this.aborted = true;
        this.req.abort();
    }

    _isDNSErr (err) {
        return err.message && /ECONNREFUSED|ENOTFOUND/.test(err.message) ||
               !this.aborted && !this.hasResponse && err.code && /ECONNRESET/.test(err.code);
    }

    _onTimeout () {
        // NOTE: this handler is also called if we get an error response (for example, 404). So, we should check
        // for the response presence before raising the timeout error.
        if (!this.hasResponse) {
            this._abort();
            this.emit('fatalError', getText(MESSAGE.destRequestTimeout, this.opts.url));
        }
    }

    _onError (err) {
        if (requestAgent.shouldRegressHttps(err, this.opts)) {
            requestAgent.regressHttps(this.opts);
            this._send();
        }

        else if (this._isDNSErr(err))
            this.emit('fatalError', getText(MESSAGE.cantResolveUrl, this.opts.url));
        else
            this.emit('error');
    }
}

// NOTE: Exposed for testing purposes.
DestinationRequest.TIMEOUT     = 25 * 1000;
DestinationRequest.XHR_TIMEOUT = 2 * 60 * 1000;
