const express               = require('express');
const http                  = require('http');
const https                 = require('https');
const http2                 = require('http2');
const Session               = require('../../../lib/session');
const { win: isWindows }    = require('os-family');
const path                  = require('path');
const { expect }            = require('chai');
const urlUtils              = require('../../../lib/utils/url');
const Proxy                 = require('../../../lib/proxy');
const selfSignedCertificate = require('openssl-self-signed-certificate');
const createServer          = require('net').createServer;

const {
    PROXY_HOSTNAME,
    PROXY_PORT_1,
    PROXY_PORT_2,
    SAME_DOMAIN_SERVER_PORT,
} = require('./constants');

const { HTTP2_HEADER_METHOD, HTTP2_HEADER_PATH } = http2.constants;

exports.createDestinationServer = function (port = SAME_DOMAIN_SERVER_PORT, isHttps = false) {
    const app    = express();
    const server = isHttps ? https.createServer(selfSignedCertificate, app) : http.createServer(app);

    server.listen(port);

    return { server, app };
};

exports.createHttp2DestServer = function (port = SAME_DOMAIN_SERVER_PORT) {
    const handlers = { get: {}, post: {} };
    const server   = http2.createSecureServer(selfSignedCertificate).listen(port);

    server.on('stream', (stream, headers) => {
        const method = headers[HTTP2_HEADER_METHOD].toLowerCase();
        const url    = headers[HTTP2_HEADER_PATH];

        if (!handlers[method])
            throw new Error('Unsupported method!');

        const handler = handlers[method][url];

        if (!handler)
            throw new Error('Unknown path!');

        handler(stream, headers);
    });

    return {
        server,
        get (url, handler) {
            handlers.get[url] = handler;
        },
        post (url, handler) {
            handlers.post[url] = handler;
        },
    };
};

exports.createSession = function (parameters) {
    parameters = parameters || {
        windowId: '12345',
    };

    const session = new Session('/test-upload-root', parameters);

    session.getAuthCredentials = () => null;
    session.handleFileDownload = () => void 0;
    session.handleAttachment   = () => void 0;

    return session;
};

exports.getFileProtocolUrl = function (filePath) {
    return 'file:' + (isWindows ? '///' : '//') + path.resolve(__dirname, filePath).replace(/\\/g, '/');
};

function trim (str) {
    return str.replace(/^\s+|\s+$/g, '');
}

function normalizeCode (code) {
    return trim(code
        .replace(/(\r\n|\n|\r)/gm, ' ')
        .replace(/'/gm, '"')
        .replace(/\s+/gm, ' '));
}

exports.compareCode = function (code1, code2) {
    code1 = normalizeCode(code1);
    code2 = normalizeCode(code2);

    expect(code1).eql(code2);
};

exports.getBasicProxyUrl = function (url, resourceType, reqOrigin, credentials, isCrossDomain = false, urlSession) {
    if (resourceType)
        resourceType = urlUtils.getResourceTypeString(resourceType);

    return urlUtils.getProxyUrl(url, {
        proxyHostname: PROXY_HOSTNAME,
        proxyPort:     isCrossDomain ? PROXY_PORT_2 : PROXY_PORT_1,
        sessionId:     urlSession.id,
        windowId:      urlSession.options.windowId,

        resourceType, reqOrigin, credentials,
    });
};

exports.createAndStartProxy = function (proxyOptions = {}) {
    const proxy = new Proxy();

    const resultOptions = Object.assign({}, {
        hostname: PROXY_HOSTNAME,
        port1:    PROXY_PORT_1,
        port2:    PROXY_PORT_2,
    }, proxyOptions);

    proxy.start(resultOptions);

    return proxy;
};

exports.normalizeNewLine = function (str) {
    return str.replace(/\r\n/g, '\n');
};

exports.replaceLastAccessedTime = function (cookie) {
    return cookie.replace(/[a-z0-9]+\|=/, '%lastAccessed%|=');
};

function createServerOnFreePort () {
    return new Promise(resolve => {
        const server = createServer();

        server.once('listening', () => {
            resolve(server);
        });

        server.listen(0);
    });
}

function closeServers (servers) {
    return Promise.all(servers.map(server => {
        return new Promise(resolve => {
            server.once('close', resolve);
            server.close();
        });
    }));
}

function getFreePorts (count) {
    const serverPromises = [];
    let ports          = null;

    // NOTE: Sequentially collect listening
    // servers to avoid interference.
    for (let i = 0; i < count; i++)
        serverPromises.push(createServerOnFreePort());

    return Promise.all(serverPromises)
        .then(servers => {
            ports = servers.map(server => {
                return server.address().port;
            });

            return servers;
        })
        .then(closeServers)
        .then(() => {
            return ports;
        });
}

exports.getFreePort = function () {
    return getFreePorts(1).then(ports => {
        return ports[0];
    });
};

function parseResponse (response) {
    const contentType = response.headers.get('content-type');

    return contentType?.includes('application/json')
        ? response.json()
        : response.text();
}

exports.request = async function (options) {
    const res      = {};
    const isString = typeof options === 'string';
    const url      = isString
        ? options
        : options.url;

    options = isString
        ? {}
        : options;

    /*eslint-disable no-undef*/
    const response = await fetch(url, options);
    /*eslint-enable no-undef*/

    res.statusCode    = response.status;
    res.headers       = Object.fromEntries(response.headers);
    res.originHeaders = response.headers;
    res.ok            = response.ok;

    try {
        res.body = await parseResponse(response);
    }
    finally {
        /*eslint-disable no-unsafe-finally*/
        return res;
        /*eslint-enable no-unsafe-finally*/
    }
};
