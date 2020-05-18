import net from 'net';
import RequestOptions from '../request-options';
import http from 'http';
import https from 'https';
import { noop } from 'lodash';
import semver from 'semver';
import * as requestAgent from './agent';
import { EventEmitter } from 'events';
// @ts-ignore
import { getAuthInfo, addCredentials, requiresResBody } from 'webauth';
import connectionResetGuard from '../connection-reset-guard';
import { MESSAGE, getText } from '../../messages';
import { transformHeadersCaseToRaw } from '../header-transforms';
import logger from '../../utils/logger';

const TUNNELING_SOCKET_ERR_RE    = /tunneling socket could not be established/i;
const TUNNELING_AUTHORIZE_ERR_RE = /statusCode=407/i;
const SOCKET_HANG_UP_ERR_RE      = /socket hang up/i;
const IS_DNS_ERR_MSG_RE          = /ECONNREFUSED|ENOTFOUND|EPROTO/;
const IS_DNS_ERR_CODE_RE         = /ECONNRESET/;

// NOTE: Starting from 8.6 version, Node.js changes behavior related with sending requests
// to sites using SSL2 and SSL3 protocol versions. It affects the https core module
// and can break a proxying of some sites. This is why, we are forced to use the special hack.
// For details, see https://github.com/nodejs/node/issues/16196
const IS_NODE_VERSION_GREATER_THAN_8_5: boolean = semver.gt(process.version, '8.5.0');

interface DestinationRequestEvents {
    on(event: 'response', listener: (res: http.IncomingMessage) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: 'socketHangUp', listener: () => void): this;
    on(event: 'fatalError', listener: (err: string) => void): this;
}

export default class DestinationRequest extends EventEmitter implements DestinationRequestEvents {
    private req: http.ClientRequest;
    private hasResponse: boolean = false;
    private credentialsSent: boolean = false;
    private aborted: boolean = false;
    private readonly opts: RequestOptions;
    private readonly isHttps: boolean;
    private readonly protocolInterface: any;
    private readonly timeout: number;

    static TIMEOUT = 25 * 1000;
    static AJAX_TIMEOUT = 2 * 60 * 1000;

    constructor (opts: RequestOptions) {
        super();

        this.opts              = opts;
        this.isHttps           = opts.protocol === 'https:';
        this.protocolInterface = this.isHttps ? https : http;
        this.timeout           = this.opts.isAjax ? DestinationRequest.AJAX_TIMEOUT : DestinationRequest.TIMEOUT;

        // NOTE: Ignore SSL auth.
        if (this.isHttps) {
            opts.rejectUnauthorized = false;

            if (IS_NODE_VERSION_GREATER_THAN_8_5)
                opts.ecdhCurve = 'auto';
        }

        requestAgent.assign(this.opts);
        this._send();
    }

    _send (waitForData?: boolean): void {
        connectionResetGuard(() => {
            const storedHeaders = this.opts.headers;

            // NOTE: The headers are converted to raw headers because some sites ignore headers in a lower case. (GH-1380)
            // We also need to restore the request option headers to a lower case because headers may change
            // if a request is unauthorized, so there can be duplicated headers, for example, 'www-authenticate' and 'WWW-Authenticate'.
            this.opts.headers = transformHeadersCaseToRaw(this.opts.headers, this.opts.rawHeaders);
            this.req          = this.protocolInterface.request(this.opts, res => {
                if (waitForData) {
                    res.on('data', noop);
                    res.once('end', () => this._onResponse(res));
                }
            });
            this.opts.headers = storedHeaders;

            if (!waitForData)
                this.req.on('response', (res: http.IncomingMessage) => this._onResponse(res));

            this.req.on('error', (err: Error) => this._onError(err));
            this.req.on('upgrade', (res: http.IncomingMessage, socket: net.Socket, head: Buffer) => this._onUpgrade(res, socket, head));
            this.req.setTimeout(this.timeout, () => this._onTimeout());
            this.req.write(this.opts.body);
            this.req.end();

            logger.destination('Destination request %s %s %s %j', this.opts.requestId, this.opts.method, this.opts.url, this.opts.headers);
        });
    }

    _shouldResendWithCredentials (res): boolean {
        if (res.statusCode === 401 && this.opts.credentials) {
            const authInfo = getAuthInfo(res);

            // NOTE: If we get 401 status code after credentials are sent, we should stop trying to authenticate.
            if (!authInfo.isChallengeMessage && this.credentialsSent)
                return false;

            return authInfo.canAuthorize;
        }

        return false;
    }

    _onResponse (res: http.IncomingMessage): void {
        logger.destination('Destination response %s %d %j', this.opts.requestId, res.statusCode, res.headers);

        if (this._shouldResendWithCredentials(res))
            this._resendWithCredentials(res);
        else if (!this.isHttps && this.opts.proxy && res.statusCode === 407) {
            logger.destination('Destination error: Cannot authorize to proxy %s', this.opts.requestId);
            this._fatalError(MESSAGE.cantAuthorizeToProxy, this.opts.proxy.host);
        }
        else {
            this.hasResponse = true;
            this.emit('response', res);
        }
    }

    _onUpgrade (res: http.IncomingMessage, socket: net.Socket, head: Buffer): void {
        logger.destination('Destination upgrade %s %d %j', this.opts.requestId, res.statusCode, res.headers);

        if (head && head.length)
            socket.unshift(head);

        this._onResponse(res);
    }

    async _resendWithCredentials (res): Promise<void> {
        logger.destination('Destination request resend request with credentials %s', this.opts.requestId);

        addCredentials(this.opts.credentials, this.opts, res, this.protocolInterface);
        this.credentialsSent = true;

        // NOTE: NTLM authentication requires using the same socket for the "negotiate" and "authenticate" requests.
        // So, before sending the "authenticate" message, we should wait for data from the "challenge" response. It
        // will mean that the socket is free.
        this._send(requiresResBody(res));
    }

    _fatalError (msg: string, url?: string): void {
        if (!this.aborted) {
            this.aborted = true;
            this.req.abort();
            this.emit('fatalError', getText(msg, url || this.opts.url));
        }
    }

    _isDNSErr (err): boolean {
        return err.message && IS_DNS_ERR_MSG_RE.test(err.message) ||
               !this.aborted && !this.hasResponse && err.code && IS_DNS_ERR_CODE_RE.test(err.code);
    }

    _isTunnelingErr (err): boolean {
        return this.isHttps && this.opts.proxy && err.message && TUNNELING_SOCKET_ERR_RE.test(err.message);
    }

    _isSocketHangUpErr (err): boolean {
        return err.message && SOCKET_HANG_UP_ERR_RE.test(err.message) &&
        // NOTE: At this moment, we determinate the socket hand up error by internal stack trace.
        // TODO: After what we will change minimal node.js version up to 8 need to rethink this code.
        err.stack && (err.stack.includes('createHangUpError') || err.stack.includes('connResetException'));
    }

    _onTimeout (): void {
        logger.destination('Destination request timeout %s (%d ms)', this.opts.requestId, this.timeout);

        // NOTE: this handler is also called if we get an error response (for example, 404). So, we should check
        // for the response presence before raising the timeout error.
        if (!this.hasResponse)
            this._fatalError(MESSAGE.destRequestTimeout);
    }

    _onError (err: Error): void {
        logger.destination('Destination error %s %o', this.opts.requestId, err);

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
            this.emit('error', err);
    }
}
