'use strict';

const expect       = require('chai').expect;
const express      = require('express');
const ntlm         = require('express-ntlm');
const auth         = require('basic-auth');
const request      = require('request');
const Proxy        = require('../../lib/proxy');
const Session      = require('../../lib/session');
const requestAgent = require('../../lib/request-pipeline/destination-request/agent');

describe('Authentication', () => {
    let proxy   = null;
    let session = null;

    beforeEach(() => {
        session = new Session();

        session.getAuthCredentials = () => null;
        session.handleFileDownload = () => {};

        proxy = new Proxy('127.0.0.1', 1836, 1837);
    });

    afterEach(() => {
        proxy.close();
        requestAgent.resetKeepAliveConnections();
    });

    describe('NTLM Authentication', () => {
        let ntlmServer = null;

        before(() => {
            const app = express();

            app.use(ntlm());

            app.all('*', (req, res) => res.end(JSON.stringify(req.ntlm)));

            ntlmServer = app.listen(1506);
        });

        after(() => ntlmServer.close());

        it('Should authorize with correct credentials', done => {
            session.getAuthCredentials = () => {
                return {
                    username:    'username',
                    password:    'password',
                    workstation: 'workstation',
                    domain:      'domain'
                };
            };

            request(proxy.openSession('http://127.0.0.1:1506/', session), (err, res, body) => {
                const parsedBody = JSON.parse(body);

                expect(res.statusCode).eql(200);
                expect(parsedBody.UserName).equal('username');
                expect(parsedBody.DomainName).equal('DOMAIN');
                expect(parsedBody.Workstation).equal('WORKSTATION');

                done();
            });
        });
    });

    describe('Basic Authentication', () => {
        let basicServer = null;

        before(() => {
            const app = express();

            app.all('*', (req, res) => {
                const credentials = auth(req);

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

        after(() => basicServer.close());

        it('Should authorize with correct credentials', done => {
            session.getAuthCredentials = () => {
                return {
                    username: 'username',
                    password: 'password'
                };
            };

            request(proxy.openSession('http://127.0.0.1:1507/', session), (err, res, body) => {
                expect(body).equal('Access granted');
                expect(res.statusCode).equal(200);

                done();
            });
        });

        it('Should not authorize with incorrect credentials', done => {
            session.getAuthCredentials = () => {
                return {
                    username: 'username',
                    password: 'invalidPassword'
                };
            };

            request(proxy.openSession('http://127.0.0.1:1507/', session), (err, res, body) => {
                expect(body).equal('Access denied');
                expect(res.statusCode).equal(401);
                // NOTE: prevent showing the native credentials window.
                expect(res.headers['www-authenticate']).to.be.undefined;
                done();
            });
        });
    });
});
