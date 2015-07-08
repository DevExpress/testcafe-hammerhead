var Browser = Hammerhead.get('./util/browser');

var createWindowMock = function (userAgent) {
    var windowMock = {
        navigator: {
            userAgent: userAgent
        }
    };

    return windowMock;
};

test('IE9', function () {
    var windowMock = createWindowMock('Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Trident/5.0; SLCC2; .NET CLR 2.0.50727; .NET CLR 3.5.30729; .NET CLR 3.0.30729; Media Center PC 6.0; .NET CLR 3.5.21022; .NET4.0C; .NET4.0E; SLCC1)');

    Browser.init(windowMock);

    ok(!Browser.isAndroid);
    ok(!Browser.isMSEdge);
    ok(!Browser.isIE11);
    ok(Browser.isIE);
    ok(!Browser.isIE10);
    ok(Browser.isIE9);
    ok(!Browser.isMozilla);
    ok(!Browser.isOpera);
    ok(!Browser.isOperaWithWebKit);
    ok(!Browser.isSafari);
    ok(!Browser.isWebKit);
    ok(!Browser.isIOS);
    ok(!Browser.hasTouchEvents);
    ok(!Browser.isTouchDevice);
    strictEqual(Browser.version, 9);
});

test('IE10', function () {
    var windowMock = createWindowMock('Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1; Trident/6.0; SLCC2; .NET CLR 2.0.50727; .NET CLR 3.5.30729; .NET CLR 3.0.30729; Media Center PC 6.0; .NET CLR 3.5.21022; .NET4.0C; .NET4.0E; SLCC1)');

    Browser.init(windowMock);

    ok(!Browser.isAndroid);
    ok(!Browser.isMSEdge);
    ok(!Browser.isIE11);
    ok(Browser.isIE);
    ok(Browser.isIE10);
    ok(!Browser.isIE9);
    ok(!Browser.isMozilla);
    ok(!Browser.isOpera);
    ok(!Browser.isOperaWithWebKit);
    ok(!Browser.isSafari);
    ok(!Browser.isWebKit);
    ok(!Browser.isIOS);
    ok(!Browser.hasTouchEvents);
    ok(!Browser.isTouchDevice);
    strictEqual(Browser.version, 10);
});

test('IE11', function () {
    var windowMock = createWindowMock('Mozilla/5.0 (Windows NT 6.3; WOW64; Trident/7.0; .NET4.0E; .NET4.0C; .NET CLR 3.5.30729; .NET CLR 2.0.50727; .NET CLR 3.0.30729; rv:11.0) like Gecko');

    Browser.init(windowMock);

    ok(!Browser.isAndroid);
    ok(!Browser.isMSEdge);
    ok(Browser.isIE11);
    ok(Browser.isIE);
    ok(!Browser.isIE10);
    ok(!Browser.isIE9);
    ok(!Browser.isMozilla);
    ok(!Browser.isOpera);
    ok(!Browser.isOperaWithWebKit);
    ok(!Browser.isSafari);
    ok(!Browser.isWebKit);
    ok(!Browser.isIOS);
    ok(!Browser.hasTouchEvents);
    ok(!Browser.isTouchDevice);
    strictEqual(Browser.version, 11);
});

test('MS Edge', function () {
    var windowMock = createWindowMock('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.9600');

    Browser.init(windowMock);

    ok(!Browser.isAndroid);
    ok(Browser.isMSEdge);
    ok(!Browser.isIE11);
    ok(Browser.isIE);
    ok(!Browser.isIE10);
    ok(!Browser.isIE9);
    ok(!Browser.isMozilla);
    ok(!Browser.isOpera);
    ok(!Browser.isOperaWithWebKit);
    ok(!Browser.isSafari);
    ok(!Browser.isWebKit);
    ok(!Browser.isIOS);
    ok(!Browser.hasTouchEvents);
    ok(!Browser.isTouchDevice);
});

test('IE9 - emulator', function () {
    var windowMock = createWindowMock('Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.3; WOW64; Trident/7.0; .NET4.0E; .NET4.0C; .NET CLR 3.5.30729; .NET CLR 2.0.50727; .NET CLR 3.0.30729)');

    Browser.init(windowMock);

    ok(!Browser.isAndroid);
    ok(!Browser.isMSEdge);
    ok(!Browser.isIE11);
    ok(Browser.isIE);
    ok(!Browser.isIE10);
    ok(Browser.isIE9);
    ok(!Browser.isMozilla);
    ok(!Browser.isOpera);
    ok(!Browser.isOperaWithWebKit);
    ok(!Browser.isSafari);
    ok(!Browser.isWebKit);
    ok(!Browser.isIOS);
    ok(!Browser.hasTouchEvents);
    ok(!Browser.isTouchDevice);
    strictEqual(Browser.version, 9);
});

test('IE10 - emulator', function () {
    var windowMock = createWindowMock('Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.3; WOW64; Trident/7.0; .NET4.0E; .NET4.0C; .NET CLR 3.5.30729; .NET CLR 2.0.50727; .NET CLR 3.0.30729');

    Browser.init(windowMock);

    ok(!Browser.isAndroid);
    ok(!Browser.isMSEdge);
    ok(!Browser.isIE11);
    ok(Browser.isIE);
    ok(Browser.isIE10);
    ok(!Browser.isIE9);
    ok(!Browser.isMozilla);
    ok(!Browser.isOpera);
    ok(!Browser.isOperaWithWebKit);
    ok(!Browser.isSafari);
    ok(!Browser.isWebKit);
    ok(!Browser.isIOS);
    ok(!Browser.hasTouchEvents);
    ok(!Browser.isTouchDevice);
    strictEqual(Browser.version, 10);
});

test('Google Chrome', function () {
    var windowMock = createWindowMock('Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/43.0.2357.130 Safari/537.36');

    Browser.init(windowMock);

    ok(!Browser.isAndroid);
    ok(!Browser.isMSEdge);
    ok(!Browser.isIE11);
    ok(!Browser.isIE);
    ok(!Browser.isIE10);
    ok(!Browser.isIE9);
    ok(!Browser.isMozilla);
    ok(!Browser.isOpera);
    ok(!Browser.isOperaWithWebKit);
    ok(!Browser.isSafari);
    ok(Browser.isWebKit);
    ok(!Browser.isIOS);
    ok(!Browser.hasTouchEvents);
    ok(!Browser.isTouchDevice);
});

test('Firefox', function () {
    var windowMock = createWindowMock('Mozilla/5.0 (Windows NT 6.3; WOW64; rv:38.0) Gecko/20100101 Firefox/38.0');

    Browser.init(windowMock);

    ok(!Browser.isAndroid);
    ok(!Browser.isMSEdge);
    ok(!Browser.isIE11);
    ok(!Browser.isIE);
    ok(!Browser.isIE10);
    ok(!Browser.isIE9);
    ok(Browser.isMozilla);
    ok(!Browser.isOpera);
    ok(!Browser.isOperaWithWebKit);
    ok(!Browser.isSafari);
    ok(!Browser.isWebKit);
    ok(!Browser.isIOS);
    ok(!Browser.hasTouchEvents);
    ok(!Browser.isTouchDevice);
});

test('Safari', function () {
    var windowMock = createWindowMock('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_3) AppleWebKit/537.75.14 (KHTML, like Gecko) Version/7.0.3 Safari/7046A194A');

    Browser.init(windowMock);

    ok(!Browser.isAndroid);
    ok(!Browser.isMSEdge);
    ok(!Browser.isIE11);
    ok(!Browser.isIE);
    ok(!Browser.isIE10);
    ok(!Browser.isIE9);
    ok(!Browser.isMozilla);
    ok(!Browser.isOpera);
    ok(!Browser.isOperaWithWebKit);
    ok(Browser.isSafari);
    ok(!Browser.isWebKit);
    ok(!Browser.isIOS);
    ok(!Browser.hasTouchEvents);
    ok(!Browser.isTouchDevice);
});

test('Android', function () {
    var windowMock = createWindowMock('Mozilla/5.0 (Linux; U; Android 4.0.3; ko-kr; LG-L160L Build/IML74K) AppleWebkit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30');

    Browser.init(windowMock);

    ok(Browser.isAndroid);
    ok(!Browser.isMSEdge);
    ok(!Browser.isIE11);
    ok(!Browser.isIE);
    ok(!Browser.isIE10);
    ok(!Browser.isIE9);
    ok(!Browser.isMozilla);
    ok(!Browser.isOpera);
    ok(!Browser.isOperaWithWebKit);
    ok(Browser.isSafari);
    ok(!Browser.isWebKit);
    ok(!Browser.isIOS);
    ok(!Browser.hasTouchEvents);
    ok(!Browser.isTouchDevice);
});

test('IOS', function () {
    var windowMock = createWindowMock('Mozilla/5.0 (iPhone; U; CPU iPhone OS 4_0 like Mac OS X; en-us) AppleWebKit/532.9 (KHTML, like Gecko) Version/4.0.5 Mobile/8A293 Safari/6531.22.7');

    Browser.init(windowMock);

    ok(!Browser.isAndroid);
    ok(!Browser.isMSEdge);
    ok(!Browser.isIE11);
    ok(!Browser.isIE);
    ok(!Browser.isIE10);
    ok(!Browser.isIE9);
    ok(!Browser.isMozilla);
    ok(!Browser.isOpera);
    ok(!Browser.isOperaWithWebKit);
    ok(Browser.isSafari);
    ok(!Browser.isWebKit);
    ok(Browser.isIOS);
    ok(!Browser.hasTouchEvents);
    ok(!Browser.isTouchDevice);
});
