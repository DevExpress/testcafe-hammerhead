const {
    createSession,
    createAndStartProxy,
    getFileProtocolUrl,
    compareCode,
} = require('../common/utils');

const {
    PAGE_ACCEPT_HEADER,
} = require('../common/constants');

const request    = require('request-promise-native');
const fs         = require('fs');
const os         = require('os');
const path       = require('path');
const { expect } = require('chai');

describe('file:// protocol', () => {
    let session = null;
    let proxy   = null;

    beforeEach(() => {
        session = createSession();
        proxy   = createAndStartProxy();
    });

    afterEach(() => {
        proxy.close();
    });

    it('Should process page and ignore search string', () => {
        session.id = 'sessionId';
        session.injectable.scripts.push('/script1.js', '/script2.js');
        session.injectable.styles.push('/styles1.css', '/styles2.css');

        session.useStateSnapshot({
            cookies:  null,
            storages: {
                localStorage:   '[["key1"],[" \' \\" \\\\ \\n \\t \\b \\f "]]',
                sessionStorage: '[["key2"],["value"]]',
            },
        });

        const options = {
            url: proxy.openSession(getFileProtocolUrl('./../data/page/src.html') + '?a=1&b=3', session),

            headers: {
                accept: PAGE_ACCEPT_HEADER,
            },
        };

        return request(options)
            .then(body => {
                // NOTE: The host property is empty in url with file: protocol.
                // The expected.html template is used for both tests with http: and file: protocol.
                const expected = fs.readFileSync('test/server/data/page/expected.html').toString()
                    .replace(/(hammerhead\|storage-wrapper\|sessionId\|)127\.0\.0\.1:2000/g, '$1')
                    .replace('!127.0.0.1%3A2000', '!');

                compareCode(body, expected);
            });
    });

    it('Should process stylesheets', () => {
        session.id = 'sessionId';

        const options = {
            url:     proxy.openSession(getFileProtocolUrl('./../data/stylesheet/src.css'), session),
            headers: {
                accept: 'text/css,*/*;q=0.1',
            },
        };

        return request(options)
            .then(body => {
                const expected = fs.readFileSync('test/server/data/stylesheet/expected.css').toString();

                compareCode(body, expected);
            });
    });

    it('Should process page with absolute urls', () => {
        session.id = 'sessionId';

        const filePostfix = os.platform() === 'win32' ? 'win' : 'nix';
        const fileUrl     = getFileProtocolUrl('./../data/page-with-file-protocol/src-' + filePostfix + '.html');

        const options = {
            url:     proxy.openSession(fileUrl, session),
            headers: {
                accept: 'text/html,*/*;q=0.1',
            },
        };

        return request(options)
            .then(body => {
                const filePath = 'test/server/data/page-with-file-protocol/expected-' + filePostfix + '.html';
                const expected = fs.readFileSync(filePath).toString();

                compareCode(body, expected);
            });
    });

    if (os.platform() === 'win32') {
        it('Should process page with non-conforming Windows url', () => {
            session.id = 'sessionId';

            const fileUrl = 'file://' + path.join(__dirname, './../data/page-with-file-protocol/src-win.html');

            const options = {
                url:     proxy.openSession(fileUrl, session),
                headers: {
                    accept: 'text/html,*/*;q=0.1',
                },
            };

            return request(options)
                .then(body => {
                    const expected = fs.readFileSync('test/server/data/page-with-file-protocol/expected-win.html').toString();

                    compareCode(body, expected);
                });
        });
    }

    it('Should set the correct content-type header', () => {
        session.id = 'sessionId';

        const options = {
            url:                     proxy.openSession(getFileProtocolUrl('./../data/images/icons.svg'), session),
            resolveWithFullResponse: true,
            headers:                 {
                accept: 'image/webp,image/*,*/*;q=0.8',
            },
        };

        return request(options)
            .then(res => {
                expect(res.headers['content-type']).eql('image/svg+xml');
            });
    });

    it('Should pass an error to the session if target is a directory', done => {
        const url = getFileProtocolUrl('./../data');

        session.id = 'sessionId';

        session.handlePageError = (ctx, err) => {
            expect(err).contains([
                'Failed to read a file at <a href="' + url + '">' + url + '</a> because of the error:',
                '',
                'The target of the operation is not a file',
            ].join('\n'));

            ctx.res.end();
            done();
            return true;
        };

        const options = {
            url:     proxy.openSession(url, session),
            headers: {
                accept: 'text/html,*/*;q=0.1',
            },
        };

        request(options);
    });

    it('Should pass an error to the session if target does not exist', done => {
        const url = getFileProtocolUrl('./../data/non-exist-file');

        session.id = 'sessionId';

        session.handlePageError = (ctx, err) => {
            expect(err).contains([
                'Failed to read a file at <a href="' + url + '">' + url + '</a> because of the error:',
                '',
                'ENOENT',
            ].join('\n'));

            ctx.res.end();
            done();
            return true;
        };

        const options = {
            url:     proxy.openSession(url, session),
            headers: {
                accept: 'text/html,*/*;q=0.1',
            },
        };

        request(options);
    });

    it('Should pass an error to the session if target (a file in an "asar" archive) does not exist (GH-2033)', done => {
        const url      = getFileProtocolUrl('./../data/file-in-asar-archive/directory-looks-like-archive.asar/app.asar/non-existent-dir/non-existent-file.txt');
        const archive  = path.resolve(__dirname, './../data/file-in-asar-archive/directory-looks-like-archive.asar/app.asar').replace(/\\/g, '/');
        const fileName = 'non-existent-dir/non-existent-file.txt';

        session.id = 'sessionId';

        session.handlePageError = (ctx, err) => {
            expect(err).contains([
                'Failed to read a file at <a href="' + url + '">' + url + '</a> because of the error:',
                '',
                'Cannot find the "' + fileName + '" file in the "' + archive + '" archive.',
            ].join('\n'));

            ctx.res.end();
            done();
            return true;
        };

        const options = {
            url:     proxy.openSession(url, session),
            headers: {
                accept: 'text/html,*/*;q=0.1',
            },
        };

        request(options);
    });

    it('Should resolve an "asar" archive file and set the correct "content-type" header (GH-2033)', () => {
        session.id = 'sessionId';

        const fileUrl = getFileProtocolUrl('./../data/file-in-asar-archive/directory-looks-like-archive.asar/app.asar/folder-in-asar-archive/another-folder/src.txt');

        const options = {
            url:                     proxy.openSession(fileUrl, session),
            resolveWithFullResponse: true,
            headers:                 {
                accept: '*/*',
            },
        };

        return request(options)
            .then(res => {
                expect(res.headers['content-type']).eql('text/plain');
                expect(res.body).eql('asar archive file: src.txt');
            });
    });
});
