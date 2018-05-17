'use strict';

const express = require('express');
const http    = require('http');
const path    = require('path');
const process = require('child_process');

const Proxy   = require('../../lib/proxy');
const Session = require('../../lib/session');

const PROXY_PORT_1 = 1401;
const PROXY_PORT_2 = 1402;
const SERVER_PORT  = 1400;

function createSession () {
    const session = new Session('test/playground/upload-storage');

    session._getIframePayloadScript = () => '';
    session._getPayloadScript       = () => '';
    session.getAuthCredentials      = () => ({});
    session.handleFileDownload      = () => void 0;
    session.handlePageError         = (ctx, err) => {
        console.log(ctx.req.url);
        console.log(err);
    };

    return session;
}

exports.start = sslOptions => {
    const app       = express();
    const appServer = http.createServer(app);
    const proxy     = new Proxy('localhost', PROXY_PORT_1, PROXY_PORT_2, sslOptions);

    app.use(express.bodyParser());

    app.get('*', (req, res) => {
        res.sendfile(path.resolve(__dirname, 'views/index.html'));
    });

    app.post('*', (req, res) => {
        let url = req.param('url');

        if (!url) {
            res
                .status(403)
                .sendfile(path.resolve(__dirname, 'views/403.html'));
        }
        else {
            if (!/^(?:file|https?):\/\//.test(url)) {
                const matches = url.match(/^([A-Za-z]:)?(\/|\\)/);

                if (matches && matches[0].length === 1)
                    url = 'file://' + url;
                else if (matches && matches[0].length > 1)
                    url = 'file:///' + url;
                else
                    url = 'http://' + url;
            }

            res
                .status(301)
                .set('location', proxy.openSession(url, createSession()))
                .end();
        }
    });

    appServer.listen(SERVER_PORT);
    console.log('Server listens on port ' + SERVER_PORT);
    process.exec('start http://localhost:' + SERVER_PORT);
};
