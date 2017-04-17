var express = require('express');
var fs      = require('fs');
var http    = require('http');
var path    = require('path');
var process = require('child_process');

var Proxy    = require('../../lib/proxy');
var Session  = require('../../lib/session');
var urlUtils = require('../../lib/utils/url');

//Const
var SERVER_HOSTNAME = 'localhost';
var SERVER_PORT     = 1400;
var SERVER_HOST     = 'http://' + SERVER_HOSTNAME + ':' + SERVER_PORT;
var PROXY_PORT_1    = 1401;
var PROXY_PORT_2    = 1402;

var TESTS_HOST = 'http://w3c-test.org/';
var taskScript = fs.readFileSync('./test/web-platform/task.js').toString();
var tests      = JSON.parse(fs.readFileSync('./test/web-platform/tests.json'));

var sessions = {};

function createSession () {
    var session = new Session('test/web-platform');

    var currentTestIndex = 0;
    session.report       = {};

    session._getIframePayloadScript = function () {
        return '';
    };

    session.testCompleted = function (msg) {
        this.report[msg.data.test] = {
            passed: msg.data.passed,
            failed: msg.data.failed
        };

        currentTestIndex++;

        if (currentTestIndex >= tests.length)
            return SERVER_HOST + '/report/' + this.id;
        else
            return urlUtils.getProxyUrl(TESTS_HOST +
                                        tests[currentTestIndex], SERVER_HOSTNAME, PROXY_PORT_1, this.id);
    };

    session._getPayloadScript = function () {
        return taskScript;
    };

    session.getAuthCredentials = function () {
        return {};
    };

    session.handleFileDownload = function () {
    };

    session.handlePageError = function () {
    };

    sessions[session.id] = session;

    return session;
}

exports.start = function (callback) {
    var app       = express();
    var proxy     = new Proxy(SERVER_HOSTNAME, PROXY_PORT_1, PROXY_PORT_2);
    var appServer = http.createServer(app);

    app
        .use(express.bodyParser())
        .set('view engine', 'ejs')
        .set('view options', { layout: false })
        .set('views', path.join(__dirname, './views'));

    app.get('/start', function (req, res) {
        res.statusCode = 301;

        res.setHeader('location', proxy.openSession(TESTS_HOST + tests[0], createSession()));
        res.end();
    });

    app.get('/report/:sessionId', function (req, res) {
            var session = sessions[req.params.sessionId];

            if (callback)
                callback(session.report);

            var passedTestsCount = 0;
            var failedTests      = [];

            for (var test in session.report) {
                if (session.report.hasOwnProperty(test)) {
                    if (session.report[test].failed.length === 0)
                        passedTestsCount++;
                    else {
                        failedTests.push({
                            url:      urlUtils.parseProxyUrl(test).originUrl,
                            subTests: session.report[test].failed
                        });
                    }
                }
            }

            res.render('report', {
                passedTestsCount: passedTestsCount,
                failedTests:      failedTests
            });
        }
    );

    app.get('*', function (req, res) {
        res.render('index', { tests: tests });
    });

    appServer.listen(SERVER_PORT);

    if (callback)
        return proxy.openSession(TESTS_HOST + tests[0], createSession());

    process.exec('start ' + SERVER_HOST);
};
