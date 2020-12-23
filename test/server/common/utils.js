const express            = require('express');
const Session            = require('../../../lib/session');
const { win: isWindows } = require('os-family');
const path               = require('path');
const { expect }         = require('chai');
const urlUtils           = require('../../../lib/utils/url');
const Proxy              = require('../../../lib/proxy');

const {
    PROXY_HOSTNAME,
    PROXY_PORT_1,
    PROXY_PORT_2,
    SAME_DOMAIN_SERVER_PORT
} = require('./constants');

exports.createDestinationServer = function (port = SAME_DOMAIN_SERVER_PORT) {
    const app    = express();
    const server = app.listen(port);

    return { server, app };
};

exports.createSession = function (parameters) {
    parameters = parameters || {
        windowId: '12345'
    };

    const session = new Session('/test-upload-root', parameters);

    session.getAuthCredentials = () => null;
    session.handleFileDownload = () => void 0;

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

        resourceType, reqOrigin, credentials
    });
};

exports.createProxy = function (sslOptions) {
    return new Proxy(PROXY_HOSTNAME, PROXY_PORT_1, PROXY_PORT_2, { ssl: sslOptions });
};

exports.normalizeNewLine = function (str) {
    return str.replace(/\r\n/g, '\n');
};

exports.replaceLastAccessedTime = function (cookie) {
    return cookie.replace(/[a-z0-9]+=/, '%lastAccessed%=');
};
