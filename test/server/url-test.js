const expect   = require('chai').expect;
const urlLib   = require('url');
const urlUtils = require('../../lib/utils/url');

const urlReplacer = resourceUrl => {
    resourceUrl = urlLib.resolve('http://example.com/', resourceUrl);

    return urlUtils.getProxyUrl(resourceUrl, {
        proxyHostname: 'localhost',
        proxyPort:     1836,
        sessionId:     'sid',
    });
};

describe('Urls', () => {
    it('Should correctly parse the content attribute of the meta with the refresh type', () => {
        const testCases = {
            '3;url=/test':         '3;url=http://localhost:1836/sid/http://example.com/test',
            '3,url=/test':         '3,url=http://localhost:1836/sid/http://example.com/test',
            '3,/test':             '3,http://localhost:1836/sid/http://example.com/test',
            '3;url    =    /test': '3;url    =    http://localhost:1836/sid/http://example.com/test',
            '1,3;url=/test':       '1,http://localhost:1836/sid/http://example.com/3;url=/test',
            "1;url= '/test'":      "1;url= 'http://localhost:1836/sid/http://example.com/test'",
            '1;"/test"':           '1;"http://localhost:1836/sid/http://example.com/test"',
            "1;URL=''":            "1;URL='http://localhost:1836/sid/http://example.com/%27",
            '1;""':                '1;"http://localhost:1836/sid/http://example.com/%22',
            '1;uRl=':              '1;uRl=',
            '1;url="\'':           '1;url="http://localhost:1836/sid/http://example.com/%27',
        };

        for (const testCase of Object.keys(testCases))
            expect(urlUtils.processMetaRefreshContent(testCase, urlReplacer)).eql(testCases[testCase]);
    });
});
