const Cookies = require('../../lib/session/cookies');
const expect  = require('chai').expect;

describe('Cookies', () => {
    const cookieJar = new Cookies();

    describe('Get cookies', () => {
        beforeEach(() => {
            cookieJar.setCookies([
                { name: 'apiCookie1', value: 'value1', domain: 'domain1.com', path: '/' },
                { name: 'apiCookie1', value: 'value1', domain: 'domain2.com', path: '/' },
                { name: 'apiCookie2', value: 'value2', domain: 'domain2.com', path: '/' },
                { name: 'apiCookie3', value: 'value3', domain: 'domain2.com', path: '/path-1' },
                { name: 'apiCookie4', value: 'value4', domain: 'domain1.com', path: '/path-2' },
                { name: 'apiCookie5', value: 'value5', domain: 'domain2.com', path: '/path-1' },
            ]);
        });

        afterEach(() => {
            cookieJar.deleteCookies();
            cookieJar._pendingSyncCookies = [];
        });

        it('Should get all cookies', () => {
            const expectedCookies = [
                {
                    'name':     'apiCookie1',
                    'value':    'value1',
                    'domain':   'domain1.com',
                    'path':     '/',
                    'expires':  void 0,
                    'maxAge':   void 0,
                    'secure':   false,
                    'httpOnly': false,
                    'sameSite': 'none',
                },
                {
                    'name':     'apiCookie1',
                    'value':    'value1',
                    'domain':   'domain2.com',
                    'path':     '/',
                    'expires':  void 0,
                    'maxAge':   void 0,
                    'secure':   false,
                    'httpOnly': false,
                    'sameSite': 'none',
                },
                {
                    'name':     'apiCookie2',
                    'value':    'value2',
                    'domain':   'domain2.com',
                    'path':     '/',
                    'expires':  void 0,
                    'maxAge':   void 0,
                    'secure':   false,
                    'httpOnly': false,
                    'sameSite': 'none',
                },
                {
                    'name':     'apiCookie3',
                    'value':    'value3',
                    'domain':   'domain2.com',
                    'path':     '/path-1',
                    'expires':  void 0,
                    'maxAge':   void 0,
                    'secure':   false,
                    'httpOnly': false,
                    'sameSite': 'none',
                },
                {
                    'name':     'apiCookie4',
                    'value':    'value4',
                    'domain':   'domain1.com',
                    'path':     '/path-2',
                    'expires':  void 0,
                    'maxAge':   void 0,
                    'secure':   false,
                    'httpOnly': false,
                    'sameSite': 'none',
                },
                {
                    'name':     'apiCookie5',
                    'value':    'value5',
                    'domain':   'domain2.com',
                    'path':     '/path-1',
                    'expires':  void 0,
                    'maxAge':   void 0,
                    'secure':   false,
                    'httpOnly': false,
                    'sameSite': 'none',
                },
            ];
            const cookies         = cookieJar.getCookies();

            expect(expectedCookies).eql(cookies);
        });

        it('Should get cookies by name', () => {
            const expectedCookies = [
                {
                    'name':     'apiCookie1',
                    'value':    'value1',
                    'domain':   'domain1.com',
                    'path':     '/',
                    'expires':  void 0,
                    'maxAge':   void 0,
                    'secure':   false,
                    'httpOnly': false,
                    'sameSite': 'none',
                },
                {
                    'name':     'apiCookie1',
                    'value':    'value1',
                    'domain':   'domain2.com',
                    'path':     '/',
                    'expires':  void 0,
                    'maxAge':   void 0,
                    'secure':   false,
                    'httpOnly': false,
                    'sameSite': 'none',
                },
            ];
            const cookies         = cookieJar.getCookies([{ name: 'apiCookie1' }]);

            expect(expectedCookies).eql(cookies);
        });

        it('Should get cookies by names', () => {
            const expectedCookies = [
                {
                    'name':     'apiCookie1',
                    'value':    'value1',
                    'domain':   'domain1.com',
                    'path':     '/',
                    'expires':  void 0,
                    'maxAge':   void 0,
                    'secure':   false,
                    'httpOnly': false,
                    'sameSite': 'none',
                },
                {
                    'name':     'apiCookie1',
                    'value':    'value1',
                    'domain':   'domain2.com',
                    'path':     '/',
                    'expires':  void 0,
                    'maxAge':   void 0,
                    'secure':   false,
                    'httpOnly': false,
                    'sameSite': 'none',
                },
                {
                    'name':     'apiCookie4',
                    'value':    'value4',
                    'domain':   'domain1.com',
                    'path':     '/path-2',
                    'expires':  void 0,
                    'maxAge':   void 0,
                    'secure':   false,
                    'httpOnly': false,
                    'sameSite': 'none',
                },
            ];
            const cookies         = cookieJar.getCookies([
                { name: 'apiCookie1' },
                { name: 'apiCookie4' },
            ]);

            expect(expectedCookies).eql(cookies);
        });

        it('Should get cookies by name and url', () => {
            const expectedCookies = [
                {
                    'name':     'apiCookie4',
                    'value':    'value4',
                    'domain':   'domain1.com',
                    'path':     '/path-2',
                    'expires':  void 0,
                    'maxAge':   void 0,
                    'secure':   false,
                    'httpOnly': false,
                    'sameSite': 'none',
                },
            ];
            const cookies         = cookieJar.getCookies([{ name: 'apiCookie4' }], ['https://domain1.com/path-2']);

            expect(expectedCookies).eql(cookies);
        });

        it('Should get cookies by names and url', () => {
            const expectedCookies = [
                {
                    'name':     'apiCookie3',
                    'value':    'value3',
                    'domain':   'domain2.com',
                    'path':     '/path-1',
                    'expires':  void 0,
                    'maxAge':   void 0,
                    'secure':   false,
                    'httpOnly': false,
                    'sameSite': 'none',
                },
                {
                    'name':     'apiCookie5',
                    'value':    'value5',
                    'domain':   'domain2.com',
                    'path':     '/path-1',
                    'expires':  void 0,
                    'maxAge':   void 0,
                    'secure':   false,
                    'httpOnly': false,
                    'sameSite': 'none',
                },
            ];
            const cookies         = cookieJar.getCookies([
                { name: 'apiCookie3' },
                { name: 'apiCookie5' },
            ], ['https://domain2.com/path-1']);

            expect(expectedCookies).eql(cookies);
        });

        it('Should get cookies by name and urls', () => {
            const expectedCookies = [
                {
                    'name':     'apiCookie1',
                    'value':    'value1',
                    'domain':   'domain1.com',
                    'path':     '/',
                    'expires':  void 0,
                    'maxAge':   void 0,
                    'secure':   false,
                    'httpOnly': false,
                    'sameSite': 'none',
                },
                {
                    'name':     'apiCookie1',
                    'value':    'value1',
                    'domain':   'domain2.com',
                    'path':     '/',
                    'expires':  void 0,
                    'maxAge':   void 0,
                    'secure':   false,
                    'httpOnly': false,
                    'sameSite': 'none',
                },
            ];
            const cookies         = cookieJar.getCookies([{ name: 'apiCookie1' }], ['https://domain1.com/', 'https://domain2.com/']);

            expect(expectedCookies).eql(cookies);
        });

        it('Should get cookies by names and urls', () => {
            const expectedCookies = [
                {
                    'name':     'apiCookie1',
                    'value':    'value1',
                    'domain':   'domain1.com',
                    'path':     '/',
                    'expires':  void 0,
                    'maxAge':   void 0,
                    'secure':   false,
                    'httpOnly': false,
                    'sameSite': 'none',
                },
                {
                    'name':     'apiCookie1',
                    'value':    'value1',
                    'domain':   'domain2.com',
                    'path':     '/',
                    'expires':  void 0,
                    'maxAge':   void 0,
                    'secure':   false,
                    'httpOnly': false,
                    'sameSite': 'none',
                },
                {
                    'name':     'apiCookie2',
                    'value':    'value2',
                    'domain':   'domain2.com',
                    'path':     '/',
                    'expires':  void 0,
                    'maxAge':   void 0,
                    'secure':   false,
                    'httpOnly': false,
                    'sameSite': 'none',
                },
            ];
            const cookies         = cookieJar.getCookies([
                { name: 'apiCookie1' },
                { name: 'apiCookie2' },
            ], ['https://domain1.com/', 'https://domain2.com/']);

            expect(expectedCookies).eql(cookies);
        });

        it('Should get cookies by domain and path', () => {
            const expectedCookies = [
                {
                    'name':     'apiCookie1',
                    'value':    'value1',
                    'domain':   'domain1.com',
                    'path':     '/',
                    'expires':  void 0,
                    'maxAge':   void 0,
                    'secure':   false,
                    'httpOnly': false,
                    'sameSite': 'none',
                },
                {
                    'name':     'apiCookie4',
                    'value':    'value4',
                    'domain':   'domain1.com',
                    'path':     '/path-2',
                    'expires':  void 0,
                    'maxAge':   void 0,
                    'secure':   false,
                    'httpOnly': false,
                    'sameSite': 'none',
                },
            ];
            const cookies         = cookieJar.getCookies([{ domain: 'domain1.com', path: '/path-2' }]);

            expect(expectedCookies).eql(cookies);
        });

        it('Should get cookies only by domain', () => {
            const expectedCookies = [
                {
                    'name':     'apiCookie1',
                    'value':    'value1',
                    'domain':   'domain1.com',
                    'path':     '/',
                    'expires':  void 0,
                    'maxAge':   void 0,
                    'secure':   false,
                    'httpOnly': false,
                    'sameSite': 'none',
                },
                {
                    'name':     'apiCookie4',
                    'value':    'value4',
                    'domain':   'domain1.com',
                    'path':     '/path-2',
                    'expires':  void 0,
                    'maxAge':   void 0,
                    'secure':   false,
                    'httpOnly': false,
                    'sameSite': 'none',
                },
            ];
            const cookies         = cookieJar.getCookies([{ domain: 'domain1.com' }]);

            expect(expectedCookies).eql(cookies);
        });

        it('Should get cookies only by path', () => {
            const expectedCookies = [
                {
                    'name':     'apiCookie4',
                    'value':    'value4',
                    'domain':   'domain1.com',
                    'path':     '/path-2',
                    'expires':  void 0,
                    'maxAge':   void 0,
                    'secure':   false,
                    'httpOnly': false,
                    'sameSite': 'none',
                },
            ];
            const cookies         = cookieJar.getCookies([{ path: '/path-2' }]);

            expect(expectedCookies).eql(cookies);
        });

        it('Should get cookies by name, domain and path', () => {
            const expectedCookies = [
                {
                    'name':     'apiCookie1',
                    'value':    'value1',
                    'domain':   'domain1.com',
                    'path':     '/',
                    'expires':  void 0,
                    'maxAge':   void 0,
                    'secure':   false,
                    'httpOnly': false,
                    'sameSite': 'none',
                },
                {
                    'name':     'apiCookie1',
                    'value':    'value1',
                    'domain':   'domain2.com',
                    'path':     '/',
                    'expires':  void 0,
                    'maxAge':   void 0,
                    'secure':   false,
                    'httpOnly': false,
                    'sameSite': 'none',
                },
                {
                    'name':     'apiCookie1',
                    'value':    'value1',
                    'domain':   'domain2.com',
                    'path':     '/',
                    'expires':  void 0,
                    'maxAge':   void 0,
                    'secure':   false,
                    'httpOnly': false,
                    'sameSite': 'none',
                },
                {
                    'name':     'apiCookie2',
                    'value':    'value2',
                    'domain':   'domain2.com',
                    'path':     '/',
                    'expires':  void 0,
                    'maxAge':   void 0,
                    'secure':   false,
                    'httpOnly': false,
                    'sameSite': 'none',
                },
            ];
            const cookies         = cookieJar.getCookies([
                { name: 'apiCookie1' },
                { domain: 'domain2.com', path: '/' },
            ]);

            expect(expectedCookies).eql(cookies);
        });
    });

    describe('Attach secure cookies to request', () => {
        beforeEach(() => {
            cookieJar.setCookies([
                { name: 'apiCookie1', value: 'value1', domain: 'domain1.com', path: '/', secure: true },
                { name: 'apiCookie2', value: 'value2', domain: 'localhost', path: '/', secure: true },
                { name: 'apiCookie3', value: 'value3', domain: '127.0.0.1', path: '/', secure: true },
            ]);
        });

        afterEach(() => {
            cookieJar.deleteCookies();
            cookieJar._pendingSyncCookies = [];
        });

        it('Should get secure cookies string from ssl domain', () => {
            const expectedCookieString = 'apiCookie1=value1';
            const destInfo             = { url: 'https://domain1.com/', hostname: 'domain1.com' };
            const cookieStr            = cookieJar.getHeader(destInfo);

            expect(cookieStr).eql(expectedCookieString);
        });

        it('Should get secure cookies string from localhost', () => {
            const expectedCookieString1 = 'apiCookie2=value2';
            const expectedCookieString2 = 'apiCookie3=value3';

            const destInfo1  = { url: 'http://localhost:3006', hostname: 'localhost' };
            const destInfo2  = { url: 'http://127.0.0.1:3001', hostname: '127.0.0.1' };
            const cookieStr1 = cookieJar.getHeader(destInfo1);
            const cookieStr2 = cookieJar.getHeader(destInfo2);

            expect(cookieStr1).eql(expectedCookieString1);
            expect(cookieStr2).eql(expectedCookieString2);
        });

        it('Should return null if domain is not HTTPS', () => {
            const expectedCookieString = null;
            const destInfo1  = { url: 'http://domain1.com', hostname: 'domain1.com' };
            const cookieStr1 = cookieJar.getHeader(destInfo1);

            expect(cookieStr1).eql(expectedCookieString);
        });
    });

    describe('Set cookies', () => {
        afterEach(() => {
            cookieJar.deleteCookies();
            cookieJar._pendingSyncCookies = [];
        });

        it('Should set cookie', () => {
            const expectedCookies = [
                {
                    domain:   'some-another-domain.com',
                    expires:  void 0,
                    httpOnly: false,
                    maxAge:   void 0,
                    name:     'apiCookie13',
                    path:     '/',
                    sameSite: 'none',
                    secure:   false,
                    value:    'value13',
                },
            ];

            cookieJar.setCookies([{
                name:   'apiCookie13',
                value:  'value13',
                domain: 'some-another-domain.com',
                path:   '/',
            }]);

            const cookies = cookieJar.getCookies();

            expect(cookies).eql(expectedCookies);
        });

        it('Should set cookies', () => {
            const expectedCookies = [
                {
                    domain:   'some-another-domain.com',
                    expires:  void 0,
                    httpOnly: false,
                    maxAge:   void 0,
                    name:     'apiCookie13',
                    path:     '/',
                    sameSite: 'none',
                    secure:   false,
                    value:    'value13',
                },
                {
                    domain:   'some-another-domain.com',
                    expires:  void 0,
                    httpOnly: false,
                    maxAge:   void 0,
                    name:     'apiCookie14',
                    path:     '/',
                    sameSite: 'none',
                    secure:   false,
                    value:    'value14',
                },
            ];

            cookieJar.setCookies([
                { name: 'apiCookie13', value: 'value13', domain: 'some-another-domain.com', path: '/' },
                { name: 'apiCookie14', value: 'value14', domain: 'some-another-domain.com', path: '/' },
            ]);

            const cookies = cookieJar.getCookies();

            expect(cookies).eql(expectedCookies);
        });

        it('Should set cookie with url', () => {
            const expectedCookies = [
                {
                    domain:   'localhost',
                    expires:  void 0,
                    httpOnly: false,
                    maxAge:   void 0,
                    name:     'apiCookie1',
                    path:     '/',
                    sameSite: 'none',
                    secure:   false,
                    value:    'value1',
                },
            ];

            cookieJar.setCookies([{ name: 'apiCookie1', value: 'value1' }], 'http://localhost');

            const cookies = cookieJar.getCookies();

            expect(cookies).eql(expectedCookies);
        });
    });

    describe('Delete cookies', () => {
        beforeEach(() => {
            cookieJar.setCookies([
                { name: 'apiCookie1', value: 'value1', domain: 'domain1.com', path: '/' },
                { name: 'apiCookie1', value: 'value1', domain: 'domain2.com', path: '/' },
                { name: 'apiCookie2', value: 'value2', domain: 'domain2.com', path: '/' },
                { name: 'apiCookie3', value: 'value3', domain: 'domain2.com', path: '/path-1' },
                { name: 'apiCookie4', value: 'value4', domain: 'domain1.com', path: '/path-2' },
                { name: 'apiCookie5', value: 'value5', domain: 'domain2.com', path: '/path-1' },
            ]);
        });

        afterEach(() => {
            cookieJar.deleteCookies();
            cookieJar._pendingSyncCookies = [];
        });

        it('Should delete all cookies', () => {
            expect(cookieJar.getCookies().length).eql(6);
            cookieJar.deleteCookies();
            expect(cookieJar.getCookies().length).eql(0);

        });

        it('Should delete cookies by name', () => {
            expect(cookieJar.getCookies().length).eql(6);
            cookieJar.deleteCookies([{ name: 'apiCookie1' }]);

            const currentCookies = cookieJar.getCookies();

            expect(currentCookies.length).eql(4);
            expect(currentCookies.some(c => c.name === 'apiCookie1')).not.ok;

        });

        it('Should delete cookies by names', () => {
            expect(cookieJar.getCookies().length).eql(6);
            cookieJar.deleteCookies([
                { name: 'apiCookie1' },
                { name: 'apiCookie3' },
            ]);

            const currentCookies = cookieJar.getCookies();

            expect(currentCookies.length).eql(3);
            expect(currentCookies.some(c => c.name === 'apiCookie1')).not.ok;
            expect(currentCookies.some(c => c.name === 'apiCookie3')).not.ok;

        });

        it('Should delete cookies by name and url', () => {
            expect(cookieJar.getCookies().length).eql(6);
            cookieJar.deleteCookies([{ name: 'apiCookie1' }], ['https://domain1.com/']);

            const currentCookies = cookieJar.getCookies();

            expect(currentCookies.length).eql(5);
            expect(currentCookies.some(c => c.name === 'apiCookie1' && c.domain === 'domain1.com')).not.ok;
            expect(currentCookies.some(c => c.name === 'apiCookie1' && c.domain === 'domain2.com')).ok;

        });

        it('Should delete cookies by names and url', () => {
            expect(cookieJar.getCookies().length).eql(6);
            cookieJar.deleteCookies([
                { name: 'apiCookie1' },
                { name: 'apiCookie2' },
            ], ['https://domain2.com/']);

            const currentCookies = cookieJar.getCookies();

            expect(currentCookies.length).eql(4);
            expect(currentCookies.some(c => c.name === 'apiCookie1' && c.domain === 'domain2.com')).not.ok;
            expect(currentCookies.some(c => c.name === 'apiCookie2' && c.domain === 'domain2.com')).not.ok;
            expect(currentCookies.some(c => c.name === 'apiCookie1' && c.domain === 'domain1.com')).ok;

        });

        it('Should delete cookies by name and urls', () => {
            expect(cookieJar.getCookies().length).eql(6);
            cookieJar.deleteCookies([{ name: 'apiCookie1' }], ['https://domain1.com/', 'https://domain2.com/']);

            const currentCookies = cookieJar.getCookies();

            expect(currentCookies.length).eql(4);
            expect(currentCookies.some(c => c.name === 'apiCookie1')).not.ok;

        });

        it('Should delete cookies by names and urls', () => {
            expect(cookieJar.getCookies().length).eql(6);
            cookieJar.deleteCookies([
                { name: 'apiCookie1' },
                { name: 'apiCookie3' },
            ], ['https://domain1.com/', 'https://domain2.com/path-1']);

            const currentCookies = cookieJar.getCookies();

            expect(currentCookies.length).eql(4);
            expect(currentCookies.some(c => c.name === 'apiCookie1' && c.domain === 'domain1.com')).not.ok;
            expect(currentCookies.some(c => c.name === 'apiCookie1' && c.domain === 'domain2.com' && c.path ===
                                            'path-1')).not.ok;
            expect(currentCookies.some(c => c.name === 'apiCookie3' && c.domain === 'domain1.com')).not.ok;
            expect(currentCookies.some(c => c.name === 'apiCookie3' && c.domain === 'domain2.com' && c.path ===
                                            'path-1')).not.ok;

        });

        it('Should delete cookies by domain and path', () => {
            expect(cookieJar.getCookies().length).eql(6);
            cookieJar.deleteCookies([{ domain: 'domain1.com', path: '/path-2' }]);

            const currentCookies = cookieJar.getCookies();

            expect(currentCookies.length).eql(5);
            expect(currentCookies.some(c => c.domain === 'domain1.com' && c.path === 'path-2')).not.ok;

        });

        it('Should delete cookies only by domain', () => {
            expect(cookieJar.getCookies().length).eql(6);
            cookieJar.deleteCookies([{ domain: 'domain1.com' }]);

            const currentCookies = cookieJar.getCookies();

            expect(currentCookies.length).eql(4);
            expect(currentCookies.some(c => c.domain === 'domain1.com')).not.ok;

        });

        it('Should delete cookies only by path', () => {
            expect(cookieJar.getCookies().length).eql(6);
            cookieJar.deleteCookies([{ path: '/path-2' }]);

            const currentCookies = cookieJar.getCookies();

            expect(currentCookies.length).eql(5);
            expect(currentCookies.some(c => c.path === 'path-2')).not.ok;

        });

        it('Should delete cookies by name, domain and path', () => {
            expect(cookieJar.getCookies().length).eql(6);
            cookieJar.deleteCookies([
                { name: 'apiCookie1' },
                { domain: 'domain2.com', path: '/' },
            ]);

            const currentCookies = cookieJar.getCookies();

            expect(currentCookies.length).eql(3);
            expect(currentCookies.some(c => c.name === 'apiCookie1')).not.ok;
            expect(currentCookies.some(c => c.name === 'apiCookie2')).not.ok;
        });
    });

    describe('Sync cookies', () => {
        afterEach(() => {
            cookieJar.deleteCookies();
            cookieJar.takePendingSyncCookies();
        });

        it('Should add cookie in syncCookies that was set', () => {
            expect(cookieJar.takePendingSyncCookies().length).eql(0);

            cookieJar.setCookies([{
                name:   'apiCookie13',
                value:  'value13',
                domain: 'some-another-domain.com',
                path:   '/',
            }]);

            const pendingSyncCookies = cookieJar.takePendingSyncCookies();

            expect(pendingSyncCookies.length).eql(1);
            expect(pendingSyncCookies[0]).include({
                key:     'apiCookie13',
                value:   'value13',
                domain:  'some-another-domain.com',
                path:    '/',
                expires: void 0,
            });
        });

        it('Should add cookie in syncCookies that was deleted', () => {
            expect(cookieJar.takePendingSyncCookies().length).eql(0);

            cookieJar.setCookies([{
                name:   'apiCookie13',
                value:  'value13',
                domain: 'some-another-domain.com',
                path:   '/',
            }]);

            cookieJar.deleteCookies([{ name: 'apiCookie13' }]);

            const pendingSyncCookies = cookieJar.takePendingSyncCookies();

            expect(pendingSyncCookies.length).eql(2);
            expect(pendingSyncCookies[1].key).eql('apiCookie13');
            expect(pendingSyncCookies[1].expires).eql(new Date(0));
        });
    });
});
