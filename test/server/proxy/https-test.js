const selfSignedCertificate = require('openssl-self-signed-certificate');
const { expect }            = require('chai');
const request               = require('request-promise-native');
const fs                    = require('fs');

const {
    createSession,
    createAndStartProxy,
    compareCode,
    createDestinationServer,
} = require('../common/utils');

const {
    PAGE_ACCEPT_HEADER,
} = require('../common/constants');

describe('https proxy', () => {
    let session    = null;
    let proxy      = null;
    let destServer = null;

    before(() => {
        const sameDomainDestinationServer = createDestinationServer();
        const { app }                     = sameDomainDestinationServer;

        destServer = sameDomainDestinationServer.server;

        app.get('/page', (req, res) => {
            res.setHeader('content-type', 'text/html');
            res.end(fs.readFileSync('test/server/data/page/src.html').toString());
        });
    });

    after(() => {
        destServer.close();
    });

    beforeEach(() => {
        session = createSession();

        proxy = createAndStartProxy({
            ssl: {
                key:  selfSignedCertificate.key,
                cert: selfSignedCertificate.cert,
            },
        });
    });

    afterEach(() => {
        proxy.close();
    });

    it('Should process pages', () => {
        session.id = 'sessionId';

        session.injectable.scripts.push('/script1.js', '/script2.js');
        session.injectable.styles.push('/styles1.css', '/styles2.css');

        const options = {
            url:     proxy.openSession('http://127.0.0.1:2000/page', session),
            headers: {
                accept: PAGE_ACCEPT_HEADER,
            },
            rejectUnauthorized: false,
        };

        expect(options.url).eql('https://127.0.0.1:1836/sessionId*12345/http://127.0.0.1:2000/page');

        return request(options)
            .then(body => {
                const expected = fs.readFileSync('test/server/data/page/expected-https.html').toString();

                compareCode(body, expected);
            });
    });
});
