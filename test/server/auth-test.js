var expect       = require('chai').expect;
var express      = require('express');
var ntlm         = require('express-ntlm');
var auth         = require('basic-auth');
var request      = require('request');
var Proxy        = require('../../lib/proxy');
var Session      = require('../../lib/session');
var requestAgent = require('../../lib/request-pipeline/destination-request/agent');

describe('Authentication', function () {
    var proxy   = null;
    var session = null;

    beforeEach(function () {
        session = new Session();

        session.getAuthCredentials = function () {
            return null;
        };

        session.handleFileDownload = function () {
        };

        proxy = new Proxy('127.0.0.1', 1836, 1837);
    });

    afterEach(function () {
        proxy.close();
        requestAgent.resetKeepAliveConnections();
    });

    describe('NTLM Authentication', function () {
        var ntlmServer = null;

        before(function () {
            var app = express();

            app.use(ntlm());

            app.all('*', function (req, res) {
                res.end(JSON.stringify(req.ntlm));
            });

            ntlmServer = app.listen(1506);
        });

        after(function () {
            ntlmServer.close();
        });


        it('Should authorize with correct credentials', function (done) {
            session.getAuthCredentials = function () {
                return {
                    username:    'username',
                    password:    'password',
                    workstation: 'workstation',
                    domain:      'domain'
                };
            };

            request(proxy.openSession('http://127.0.0.1:1506/', session), function (err, res, body) {
                var parsedBody = JSON.parse(body);

                expect(res.statusCode).eql(200);
                expect(parsedBody.UserName).equal('username');
                expect(parsedBody.DomainName).equal('DOMAIN');
                expect(parsedBody.Workstation).equal('WORKSTATION');

                done();
            });
        });
    });

    describe('Basic Authentication', function () {
        var basicServer = null;

        before(function () {
            var app = express();

            app.all('*', function (req, res) {
                var credentials = auth(req);

                if (!credentials || credentials.name !== 'username' || credentials.pass !== 'password') {
                    res.statusCode = 401;
                    res.setHeader('WWW-Authenticate', 'Basic realm="example"');
                    res.end('Access denied');
                }
                else {
                    res.statusCode = 200;
                    res.end('Access granted');
                }
            });

            basicServer = app.listen(1507);
        });

        after(function () {
            basicServer.close();
        });

        it('Should authorize with correct credentials', function (done) {
            session.getAuthCredentials = function () {
                return {
                    username: 'username',
                    password: 'password'
                };
            };

            request(proxy.openSession('http://127.0.0.1:1507/', session), function (err, res, body) {
                expect(body).equal('Access granted');
                expect(res.statusCode).equal(200);

                done();
            });
        });

        it('Should not authorize with incorrect credentials', function (done) {
            session.getAuthCredentials = function () {
                return {
                    username: 'username',
                    password: 'invalidPassword'
                };
            };

            request(proxy.openSession('http://127.0.0.1:1507/', session), function (err, res, body) {
                expect(body).equal('Access denied');
                expect(res.statusCode).equal(401);

                done();
            });
        });
    });
});
