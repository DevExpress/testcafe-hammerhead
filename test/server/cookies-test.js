const Cookies = require('../../lib/session/cookies');
const expect  = require('chai').expect;

describe('Cookies', () => {
    const cookieJar = new Cookies();

    describe('Get cookies', () => {
        beforeEach(async () => {
            await cookieJar.setCookies([
                { name: 'apiCookie1', value: 'value1', domain: 'domain1.com', path: '/' },
                { name: 'apiCookie1', value: 'value1', domain: 'domain2.com', path: '/' },
                { name: 'apiCookie2', value: 'value2', domain: 'domain2.com', path: '/' },
                { name: 'apiCookie3', value: 'value3', domain: 'domain2.com', path: '/path-1' },
                { name: 'apiCookie4', value: 'value4', domain: 'domain1.com', path: '/path-2' },
                { name: 'apiCookie5', value: 'value5', domain: 'domain2.com', path: '/path-1' },
            ]);
        });

        afterEach(async () => {
            await cookieJar.deleteCookies();
        });

        it('Should get all cookies', async () => {
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
            const cookies         = await cookieJar.getCookies();

            expect(expectedCookies).eql(cookies);
        });

        it('Should get cookies by name', async () => {
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
            const cookies         = await cookieJar.getCookies([{ name: 'apiCookie1' }]);

            expect(expectedCookies).eql(cookies);
        });

        it('Should get cookies by names', async () => {
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
            const cookies         = await cookieJar.getCookies([
                { name: 'apiCookie1' },
                { name: 'apiCookie4' }
            ]);

            expect(expectedCookies).eql(cookies);
        });

        it('Should get cookies by name and url', async () => {
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
            const cookies         = await cookieJar.getCookies([{ name: 'apiCookie4' }], ['https://domain1.com/path-2']);

            expect(expectedCookies).eql(cookies);
        });

        it('Should get cookies by names and url', async () => {
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
            const cookies         = await cookieJar.getCookies([
                { name: 'apiCookie3' },
                { name: 'apiCookie5' }
            ], ['https://domain2.com/path-1']);

            expect(expectedCookies).eql(cookies);
        });

        it('Should get cookies by name and urls', async () => {
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
            const cookies         = await cookieJar.getCookies([{ name: 'apiCookie1' }], ['https://domain1.com/', 'https://domain2.com/']);

            expect(expectedCookies).eql(cookies);
        });

        it('Should get cookies by names and urls', async () => {
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
            const cookies         = await cookieJar.getCookies([
                { name: 'apiCookie1' },
                { name: 'apiCookie2' }
            ], ['https://domain1.com/', 'https://domain2.com/']);

            expect(expectedCookies).eql(cookies);
        });

        it('Should get cookies by domain and path', async () => {
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
            const cookies         = await cookieJar.getCookies([{ domain: 'domain1.com', path: '/path-2' }]);

            expect(expectedCookies).eql(cookies);
        });

        it('Should get cookies by name, domain and path', async () => {
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
            const cookies         = await cookieJar.getCookies([
                { name: 'apiCookie1' },
                { domain: 'domain2.com', path: '/' }
            ]);

            expect(expectedCookies).eql(cookies);
        });
    });

    describe('Set cookies', () => {
        afterEach(async () => {
            await cookieJar.deleteCookies();
        });

        it('Should set cookie', async () => {
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

            await cookieJar.setCookies([{
                name:   'apiCookie13',
                value:  'value13',
                domain: 'some-another-domain.com',
                path:   '/',
            }]);

            const cookies = await cookieJar.getCookies();

            expect(cookies).eql(expectedCookies);
        });

        it('Should set cookies', async () => {
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

            await cookieJar.setCookies([
                { name: 'apiCookie13', value: 'value13', domain: 'some-another-domain.com', path: '/' },
                { name: 'apiCookie14', value: 'value14', domain: 'some-another-domain.com', path: '/' },
            ]);

            const cookies = await cookieJar.getCookies();

            expect(cookies).eql(expectedCookies);
        });

        it('Should set cookie with url', async () => {
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

            await cookieJar.setCookies([{ name: 'apiCookie1', value: 'value1' }], 'http://localhost');

            const cookies = await cookieJar.getCookies();

            expect(cookies).eql(expectedCookies);
        });
    });

    describe('Delete cookies', () => {
        beforeEach(async () => {
            await cookieJar.setCookies([
                { name: 'apiCookie1', value: 'value1', domain: 'domain1.com', path: '/' },
                { name: 'apiCookie1', value: 'value1', domain: 'domain2.com', path: '/' },
                { name: 'apiCookie2', value: 'value2', domain: 'domain2.com', path: '/' },
                { name: 'apiCookie3', value: 'value3', domain: 'domain2.com', path: '/path-1' },
                { name: 'apiCookie4', value: 'value4', domain: 'domain1.com', path: '/path-2' },
                { name: 'apiCookie5', value: 'value5', domain: 'domain2.com', path: '/path-1' },
            ]);
        });

        afterEach(async () => {
            await cookieJar.deleteCookies();
        });

        it('Should delete all cookies', async () => {
            expect((await cookieJar.getCookies()).length).eql(6);
            await cookieJar.deleteCookies();
            expect((await cookieJar.getCookies()).length).eql(0);

        });

        it('Should delete cookies by name', async () => {
            expect((await cookieJar.getCookies()).length).eql(6);
            await cookieJar.deleteCookies([{ name: 'apiCookie1' }]);

            const currentCookies = await cookieJar.getCookies();

            expect(currentCookies.length).eql(4);
            expect(currentCookies.some(c => c.name === 'apiCookie1')).not.ok;

        });

        it('Should delete cookies by names', async () => {
            expect((await cookieJar.getCookies()).length).eql(6);
            await cookieJar.deleteCookies([
                { name: 'apiCookie1' },
                { name: 'apiCookie3' }
            ]);

            const currentCookies = await cookieJar.getCookies();

            expect(currentCookies.length).eql(3);
            expect(currentCookies.some(c => c.name === 'apiCookie1')).not.ok;
            expect(currentCookies.some(c => c.name === 'apiCookie3')).not.ok;

        });

        it('Should delete cookies by name and url', async () => {
            expect((await cookieJar.getCookies()).length).eql(6);
            await cookieJar.deleteCookies([{ name: 'apiCookie1' }], ['https://domain1.com/']);

            const currentCookies = await cookieJar.getCookies();

            expect(currentCookies.length).eql(5);
            expect(currentCookies.some(c => c.name === 'apiCookie1' && c.domain === 'domain1.com')).not.ok;
            expect(currentCookies.some(c => c.name === 'apiCookie1' && c.domain === 'domain2.com')).ok;

        });

        it('Should delete cookies by names and url', async () => {
            expect((await cookieJar.getCookies()).length).eql(6);
            await cookieJar.deleteCookies([
                { name: 'apiCookie1' },
                { name: 'apiCookie2' }
            ], ['https://domain2.com/']);

            const currentCookies = await cookieJar.getCookies();

            expect(currentCookies.length).eql(4);
            expect(currentCookies.some(c => c.name === 'apiCookie1' && c.domain === 'domain2.com')).not.ok;
            expect(currentCookies.some(c => c.name === 'apiCookie2' && c.domain === 'domain2.com')).not.ok;
            expect(currentCookies.some(c => c.name === 'apiCookie1' && c.domain === 'domain1.com')).ok;

        });

        it('Should delete cookies by name and urls', async () => {
            expect((await cookieJar.getCookies()).length).eql(6);
            await cookieJar.deleteCookies([{ name: 'apiCookie1' }], ['https://domain1.com/', 'https://domain2.com/']);

            const currentCookies = await cookieJar.getCookies();

            expect(currentCookies.length).eql(4);
            expect(currentCookies.some(c => c.name === 'apiCookie1')).not.ok;

        });

        it('Should delete cookies by names and urls', async () => {
            expect((await cookieJar.getCookies()).length).eql(6);
            await cookieJar.deleteCookies([
                { name: 'apiCookie1' },
                { name: 'apiCookie3' }
            ], ['https://domain1.com/', 'https://domain2.com/path-1']);

            const currentCookies = await cookieJar.getCookies();

            expect(currentCookies.length).eql(4);
            expect(currentCookies.some(c => c.name === 'apiCookie1' && c.domain === 'domain1.com')).not.ok;
            expect(currentCookies.some(c => c.name === 'apiCookie1' && c.domain === 'domain2.com' && c.path ===
                                            'path-1')).not.ok;
            expect(currentCookies.some(c => c.name === 'apiCookie3' && c.domain === 'domain1.com')).not.ok;
            expect(currentCookies.some(c => c.name === 'apiCookie3' && c.domain === 'domain2.com' && c.path ===
                                            'path-1')).not.ok;

        });

        it('Should delete cookies by domain and path', async () => {
            expect((await cookieJar.getCookies()).length).eql(6);
            await cookieJar.deleteCookies([{ domain: 'domain1.com', path: '/path-2' }]);

            const currentCookies = await cookieJar.getCookies();

            expect(currentCookies.length).eql(5);
            expect(currentCookies.some(c => c.domain === 'domain1.com' && c.path === 'path-2')).not.ok;

        });

        it('Should delete cookies by name, domain and path', async () => {
            expect((await cookieJar.getCookies()).length).eql(6);
            await cookieJar.deleteCookies([
                { name: 'apiCookie1' },
                { domain: 'domain2.com', path: '/' },
            ]);

            const currentCookies = await cookieJar.getCookies();

            expect(currentCookies.length).eql(3);
            expect(currentCookies.some(c => c.name === 'apiCookie1')).not.ok;
            expect(currentCookies.some(c => c.name === 'apiCookie2')).not.ok;
        });
    });
});
