import net from 'net';
import RequestOptions from '../request-options';
import http, { ClientRequest } from 'http';
import https from 'https';
import { noop } from 'lodash';
import * as requestAgent from './agent';
import { EventEmitter } from 'events';

import {
    getAuthInfo,
    addCredentials,
    requiresResBody,
} from './auth-credentials';

import { connectionResetGuard } from '../connection-reset-guard';
import { MESSAGE, getText } from '../../messages';
import logger from '../../utils/logger';
import * as requestCache from '../cache';
import IncomingMessageLike from '../incoming-message-like';

import {
    formatRequestHttp2Headers,
    getHttp2Session,
    Http2Response,
    createResponseLike,
} from './http2';

import { ClientHttp2Session, ClientHttp2Stream } from 'http2';
import DEFAULT_REQUEST_TIMEOUT from './default-request-timeout';

const TUNNELING_SOCKET_ERR_RE    = /tunneling socket could not be established/i;
const TUNNELING_AUTHORIZE_ERR_RE = /statusCode=407/i;
const SOCKET_HANG_UP_ERR_RE      = /socket hang up/i;
const IS_DNS_ERR_MSG_RE          = /ECONNREFUSED|ENOTFOUND|EPROTO/;
const IS_DNS_ERR_CODE_RE         = /ECONNRESET/;

interface DestinationRequestEvents {
    on(event: 'response', listener: (res: http.IncomingMessage) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: 'socketHangUp', listener: () => void): this;
    on(event: 'fatalError', listener: (err: string) => void): this;
}

export default class DestinationRequest extends EventEmitter implements DestinationRequestEvents {
    private req: ClientRequest | ClientHttp2Stream;
    private hasResponse = false;
    private credentialsSent = false;
    private aborted = false;
    private readonly protocolInterface: any;
    private readonly timeout: number;

    constructor (readonly opts: RequestOptions, readonly cache: boolean = false) {
        super();

        this.protocolInterface = this.opts.isHttps ? https : http;

        this.timeout = this._getTimeout();

        if (this.opts.isHttps)
            opts.ignoreSSLAuth();

        requestAgent.assign(this.opts);
        this._send();
    }

    private _getTimeout () {
        return this.opts.isAjax
            ? this.opts.requestTimeout && this.opts.requestTimeout.ajax || DEFAULT_REQUEST_TIMEOUT.ajax
            : this.opts.requestTimeout && this.opts.requestTimeout.page || DEFAULT_REQUEST_TIMEOUT.page;
    }

    private static _isHttp2ProtocolError (err: NodeJS.ErrnoException) {
        return err.code === 'ERR_HTTP2_STREAM_ERROR' &&
            (err.message.includes('NGHTTP2_PROTOCOL_ERROR') || err.message.includes('NGHTTP2_HTTP_1_1_REQUIRED'));
    }

    private _sendRealThroughHttp2 (session: ClientHttp2Session) {
        const reqHeaders = formatRequestHttp2Headers(this.opts);
        const endStream  = !this.opts.body.length;
        const stream     = session.request(reqHeaders, { endStream });

        stream.setTimeout(this.timeout, () => this._onTimeout());
        stream.on('error', (err: NodeJS.ErrnoException) => {
            if (DestinationRequest._isHttp2ProtocolError(err)) {
                session.destroy();
                this._sendReal();
            }
            else
                this._onError(err);
        });
        stream.on('response', headers => {
            const http2res = createResponseLike(stream, headers);

            this._onResponse(http2res);
        });

        if (!endStream) {
            stream.write(this.opts.body);
            stream.end();
        }

        this.req = stream;

        logger.destination.onHttp2Stream(this.opts.requestId, reqHeaders);
    }

    private _sendReal (waitForData?: boolean) {
        connectionResetGuard(() => {
            const preparedOpts = this.opts.prepare();

            this.req = this.protocolInterface.request(preparedOpts, res => {
                if (waitForData) {
                    res.on('data', noop);
                    res.once('end', () => this._onResponse(res));
                }
            });

            if (logger.destinationSocket.enabled) {
                this.req.on('socket', socket => {
                    socket.once('data', data => logger.destinationSocket.onFirstChunk(this.opts, data));
                    socket.once('error', err => logger.destinationSocket.onError(this.opts, err));
                });
            }

            if (!waitForData)
                this.req.on('response', (res: http.IncomingMessage) => this._onResponse(res));

            this.req.on('upgrade',
                (res: http.IncomingMessage, socket: net.Socket, head: Buffer) => this._onUpgrade(res, socket, head));
            this.req.on('error', (err: Error) => this._onError(err));
            this.req.setTimeout(this.timeout, () => this._onTimeout());
            this.req.write(this.opts.body);
            this.req.end();

            logger.destination.onRequest(this.opts);
        });
    }

    async _send (waitForData?: boolean) {
        if (this.cache) {
            const cachedResponse = requestCache.getResponse(this.opts);

            if (cachedResponse) {
                // NOTE: To store async order of the 'response' event
                setImmediate(() => this._emitOnResponse(cachedResponse.res));

                logger.destination.onCachedRequest(this.opts, cachedResponse.hitCount);

                return;
            }
        }

        const http2Session = !this.opts.disableHttp2 && this.opts.isHttps && !this.opts.isWebSocket && !this.opts.proxy &&
            await getHttp2Session(this.opts.requestId, this.opts.protocol + '//' + this.opts.host);

        if (http2Session && !http2Session.closed)
            this._sendRealThroughHttp2(http2Session);
        else
            this._sendReal(waitForData);
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

    _onResponse (res: http.IncomingMessage | Http2Response): void {
        logger.destination.onResponse(this.opts, res);

        if (this._shouldResendWithCredentials(res))
            this._resendWithCredentials(res);
        else if (!this.opts.isHttps && this.opts.proxy && res.statusCode === 407) {
            logger.destination.onProxyAuthenticationError(this.opts);
            this._fatalError(MESSAGE.cantAuthorizeToProxy, this.opts.proxy.host);
        }
        else
            this._emitOnResponse(res);
    }

    _emitOnResponse (res: http.IncomingMessage | IncomingMessageLike | Http2Response) {
        this.hasResponse = true;

        this.emit('response', res);
    }

    _onUpgrade (res: http.IncomingMessage, socket: net.Socket, head: Buffer): void {
        logger.destination.onUpgradeRequest(this.opts, res);

        if (head && head.length)
            socket.unshift(head);

        this._onResponse(res);
    }

    _resendWithCredentials (res): void {
        logger.destination.onResendWithCredentials(this.opts);

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

            this.req.destroy();
            this.emit('fatalError', getText(msg, { url: url || this.opts.url }));
        }
    }

    _isDNSErr (err): boolean {
        return err.message && IS_DNS_ERR_MSG_RE.test(err.message) ||
               !this.aborted && !this.hasResponse && err.code && IS_DNS_ERR_CODE_RE.test(err.code);
    }

    _isTunnelingErr (err): boolean {
        return this.opts.isHttps && err.message && TUNNELING_SOCKET_ERR_RE.test(err.message);
    }

    _isSocketHangUpErr (err): boolean {
        return err.message && SOCKET_HANG_UP_ERR_RE.test(err.message) &&
        // NOTE: At this moment, we determinate the socket hand up error by internal stack trace.
        // TODO: After what we will change minimal node.js version up to 8 need to rethink this code.
        err.stack && (err.stack.includes('createHangUpError') || err.stack.includes('connResetException'));
    }

    _onTimeout (): void {
        logger.destination.onTimeoutError(this.opts, this.timeout);

        // NOTE: this handler is also called if we get an error response (for example, 404). So, we should check
        // for the response presence before raising the timeout error.
        if (!this.hasResponse)
            this._fatalError(MESSAGE.destRequestTimeout);
    }

    _onError (err: Error): void {
        logger.destination.onError(this.opts, err);

        if (this._isSocketHangUpErr(err))
            this.emit('socketHangUp');

        else if (requestAgent.shouldRegressHttps(err, this.opts)) {
            requestAgent.regressHttps(this.opts);
            this._send();
        }

        else if (this.opts.proxy && this._isTunnelingErr(err)) {
            if (TUNNELING_AUTHORIZE_ERR_RE.test(err.message))
                this._fatalError(MESSAGE.cantAuthorizeToProxy, this.opts.proxy.host);
            else
                this._fatalError(MESSAGE.cantEstablishTunnelingConnection, this.opts.proxy.host);
        }

        else if (this._isDNSErr(err)) {
            if (!this.opts.isHttps && this.opts.proxy)
                this._fatalError(MESSAGE.cantEstablishProxyConnection, this.opts.proxy.host);
            else
                this._fatalError(MESSAGE.cantResolveUrl);
        }

        else
            this.emit('error', err);
    }
}
