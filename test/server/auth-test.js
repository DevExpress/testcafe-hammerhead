const expect       = require('chai').expect;
const express      = require('express');
const ntlm         = require('express-ntlm');
const auth         = require('basic-auth');
const headersUtils = require('../../lib/utils/headers');

const {
    createAndStartProxy,
    createSession,
    request,
} = require('./common/utils');

describe('Authentication', () => { // eslint-disable-line
    let proxy   = null;
    let session = null;

    beforeEach(() => {
        session = createSession();
        proxy   = createAndStartProxy();
    });

    afterEach(() => {
        proxy.close();
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

        it('Should authorize with correct credentials', () => {
            session.getAuthCredentials = () => {
                return {
                    username:    'username',
                    password:    'password',
                    workstation: 'workstation',
                    domain:      'domain',
                };
            };

            const options = {
                url:                     proxy.openSession('http://127.0.0.1:1506/', session),
                resolveWithFullResponse: true,
                json:                    true,
            };

            return request(options)
                .then(res => {
                    expect(res.statusCode).equal(200);

                    const { UserName, DomainName, Workstation } = JSON.parse(res.body);

                    expect(UserName).equal('username');
                    expect(DomainName).equal('DOMAIN');
                    expect(Workstation).equal('WORKSTATION');
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

        it('Should authorize with correct credentials', () => {
            session.getAuthCredentials = () => {
                return {
                    username: 'username',
                    password: 'password',
                };
            };

            const options = {
                url: proxy.openSession('http://127.0.0.1:1507/', session),

                resolveWithFullResponse: true,
            };

            return request(options)
                .then(res => {
                    expect(res.statusCode).equal(200);
                    expect(res.body).equal('Access granted');
                });
        });

        it('Should not authorize with incorrect credentials', () => {
            session.getAuthCredentials = () => {
                return {
                    username: 'username',
                    password: 'invalidPassword',
                };
            };

            const options = {
                url: proxy.openSession('http://127.0.0.1:1507/', session),

                resolveWithFullResponse: true,
            };

            return request(options)
                .then(err => {
                    expect(err.statusCode).equal(401);
                    expect(err.body).equal('Access denied');
                    // NOTE: prevent showing the native credentials window.
                    expect(err.headers['www-authenticate']).eql(headersUtils.addAuthenticatePrefix('Basic realm="example"'));
                });
        });

        it('Should authorize with correct credentials that passed through url', () => {
            const options = {
                url:                     proxy.openSession('http://username:password@127.0.0.1:1507/', session),
                resolveWithFullResponse: true,
            };

            return request(options)
                .then(res => {
                    expect(res.statusCode).equal(200);
                    expect(res.body).equal('Access granted');
                });
        });
    });
});
