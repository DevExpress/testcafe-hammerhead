var express = require('express');
var http    = require('http');
var Path    = require('path');
var process = require('child_process');

var Proxy   = require('../../lib/proxy');
var Session = require('../../lib/session');

//Const
var PROXY_PORT_1 = 1401;
var PROXY_PORT_2 = 1402;
var SERVER_PORT  = 1400;

function createSession () {
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

exports.start = function () {
    var app       = express();
    var proxy     = new Proxy('localhost', PROXY_PORT_1, PROXY_PORT_2);
    var appServer = http.createServer(app);

    app
        .use(express.bodyParser())
        .set('view engine', 'ejs')
        .set('view options', { layout: false })
        .set('views', Path.join(__dirname, './views'));

    app.get('*', function (req, res) {
        res.render('index');
    });

    app.post('*', function (req, res) {
        var url = req.param('url');

        if (!url) {
            res.status(403);
            res.render('403');
        }
        else {
            if (url.indexOf('file://') !== 0 && url.indexOf('http://') !== 0 && url.indexOf('https://') !== 0) {
                var matches = url.match(/^([A-Za-z]:)?(\/|\\)/);

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