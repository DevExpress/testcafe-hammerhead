'use strict';

const express = require('express');
const http    = require('http');
const Path    = require('path');
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
    session.handlePageError         = () => void 0;

    return session;
}

exports.start = () => {
    const app       = express();
    const proxy     = new Proxy('localhost', PROXY_PORT_1, PROXY_PORT_2);
    const appServer = http.createServer(app);

    app
        .use(express.bodyParser())
        .set('view engine', 'ejs')
        .set('view options', { layout: false })
        .set('views', Path.join(__dirname, './views'));

    app.get('*', (req, res) => {
        res.render('index');
    });

    app.post('*', (req, res) => {
        let url = req.param('url');

        if (!url) {
            res.status(403);
            res.render('403');
        }
        else {
            if (url.indexOf('file://') !== 0 && url.indexOf('http://') !== 0 && url.indexOf('https://') !== 0) {
                const matches = url.match(/^([A-Za-z]:)?(\/|\\)/);

                if (matches && matches[0].length === 1)
                    url = 'file://' + url;
                else if (matches && matches[0].length > 1)
                    url = 'file:///' + url;
                else
                    url = 'http://' + url;
            }

            res.statusCode = 301;

            res.setHeader('location', proxy.openSession(url, createSession()));
            res.end();
        }
    });

    appServer.listen(SERVER_PORT);
    console.log('Server listens on port ' + SERVER_PORT);
    process.exec('start http://localhost:' + SERVER_PORT);
};