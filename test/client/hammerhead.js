var proxy = null;

function createSession () {
    var Session = require('../../lib').Session;
    var session = new Session('test/playground/upload-storage');

    session._getIframePayloadScript = function () {
        return '';
    };

    session._getPayloadScript = function () {
        return '';
    };

    session.getAuthCredentials = function () {
        return {};
    };

    session.handleFileDownload = function () {
    };

    session.handlePageError = function () {
    };

    return session;
}

module.exports = {
    openSession: function (url) {
        return proxy.openSession(url, createSession());
    },

    start: function () {
        var Proxy = require('../../lib').Proxy;

        proxy = new Proxy('localhost', 8000, 8001);
    },
    close: function () {
        proxy.close();
    }
};