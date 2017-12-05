import http from 'http';
import https from 'https';
import { noop } from 'lodash';
import { short as shortNodeVersion } from 'node-version';
import * as requestAgent from './agent';
import { EventEmitter } from 'events';
import { getAuthInfo, addCredentials, requiresResBody } from 'webauth';
import connectionResetGuard from '../connection-reset-guard';
import { MESSAGE, getText } from '../../messages';

// HACK: Ignore SSL auth. The rejectUnauthorized option in the https.request method
// doesn't work (see: https://github.com/mikeal/request/issues/418).
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const TUNNELING_SOCKET_ERR_RE    = /tunneling socket could not be established/i;
const TUNNELING_AUTHORIZE_ERR_RE = /statusCode=407/i;
const SOCKET_HANG_UP_ERR_RE      = /socket hang up/i;
const IS_DNS_ERR_MSG_RE          = /ECONNREFUSED|ENOTFOUND|EPROTO/;
const IS_DNS_ERR_CODE_RE         = /ECONNRESET/;

// NOTE: Starting from 8.6 version, Node.js changes behavior related with sending requests
// to sites using SSL2 and SSL3 protocol versions. It affects the https core module
// and can break a proxying of some sites. This is why, we are forced to use the special hack.
// For details, see https://github.com/nodejs/node/issues/16196
const IS_NODE_VERSION_GREATER_THAN_8_5 = parseFloat(shortNodeVersion) > 8.5;


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
        if (this.isHttps) {
            opts.rejectUnauthorized = false;

            if (IS_NODE_VERSION_GREATER_THAN_8_5)
                opts.ecdhCurve = 'auto';
        }

        requestAgent.assign(this.opts);
        this._send();
    }

    _send (waitForData) {
        connectionResetGuard(() => {
            const timeout = this.opts.isXhr ? DestinationRequest.XHR_TIMEOUT : DestinationRequest.TIMEOUT;

            this.req = this.protocolInterface.request(this.opts, res => {
                if (waitForData) {
                    res.on('data', noop);
                    res.once('end', () => this._onResponse(res));
                }
            });

            if (!waitForData)
                this.req.on('response', res => this._onResponse(res));

            this.req.on('error', err => this._onError(err));
            this.req.on('upgrade', (res, socket, head) => this._onUpgrade(res, socket, head));
            this.req.setTimeout(timeout, () => this._onTimeout());
            this.req.write(this.opts.body);
            this.req.end();
        });
    }

    _shouldResendWithCredentials (res) {
        if (res.statusCode === 401 && this.opts.credentials) {
            const authInfo = getAuthInfo(res);

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
        else if (!this.isHttps && this.opts.proxy && res.statusCode === 407)
            this._fatalError(MESSAGE.cantAuthorizeToProxy, this.opts.proxy.host);
        else {
            this.hasResponse = true;
            this.emit('response', res);
        }
    }

    _onUpgrade (res, socket, head) {
        if (head && head.length)
            socket.unshift(head);

        this._onResponse(res);
    }

    async _resendWithCredentials (res) {
        addCredentials(this.opts.credentials, this.opts, res, this.protocolInterface);
        this.credentialsSent = true;

        // NOTE: NTLM authentication requires using the same socket for the "negotiate" and "authenticate" requests.
        // So, before sending the "authenticate" message, we should wait for data from the "challenge" response. It
        // will mean that the socket is free.
        this._send(requiresResBody(res));
    }

    _fatalError (msg, url) {
        if (!this.aborted) {
            this.aborted = true;
            this.req.abort();
            this.emit('fatalError', getText(msg, url || this.opts.url));
        }
    }

    _isDNSErr (err) {
        return err.message && IS_DNS_ERR_MSG_RE.test(err.message) ||
               !this.aborted && !this.hasResponse && err.code && IS_DNS_ERR_CODE_RE.test(err.code);
    }

    _isTunnelingErr (err) {
        return this.isHttps && this.opts.proxy && err.message && TUNNELING_SOCKET_ERR_RE.test(err.message);
    }

    _isSocketHangUpErr (err) {
        return err.message && SOCKET_HANG_UP_ERR_RE.test(err.message) &&
               // NOTE: Only for nodejs 4 error with a same message will be generated for different cases.
               // This is why, we filter a 'SocketHangUpErr' by stack.
               // Remove filtering by stack content after ending support of nodejs 4.
               err.stack && err.stack.indexOf('createHangUpError') !== -1;
    }

    _onTimeout () {
        // NOTE: this handler is also called if we get an error response (for example, 404). So, we should check
        // for the response presence before raising the timeout error.
        if (!this.hasResponse)
            this._fatalError(MESSAGE.destRequestTimeout);
    }

    _onError (err) {
        if (this._isSocketHangUpErr(err))
            this.emit('socketHangUp');

        else if (requestAgent.shouldRegressHttps(err, this.opts)) {
            requestAgent.regressHttps(this.opts);
            this._send();
        }

        else if (this._isTunnelingErr(err)) {
            if (TUNNELING_AUTHORIZE_ERR_RE.test(err.message))
                this._fatalError(MESSAGE.cantAuthorizeToProxy, this.opts.proxy.host);
            else
                this._fatalError(MESSAGE.cantEstablishTunnelingConnection, this.opts.proxy.host);
        }

        else if (this._isDNSErr(err)) {
            if (!this.isHttps && this.opts.proxy)
                this._fatalError(MESSAGE.cantEstablishProxyConnection, this.opts.proxy.host);
            else
                this._fatalError(MESSAGE.cantResolveUrl);
        }

        else
            this.emit('error');
    }
}

// NOTE: Exposed for testing purposes.
DestinationRequest.TIMEOUT     = 25 * 1000;
DestinationRequest.XHR_TIMEOUT = 2 * 60 * 1000;
