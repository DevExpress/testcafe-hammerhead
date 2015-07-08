var CookieUtil = Hammerhead.get('./util/cookie');

test('parse', function () {
    var cookieStrs = [
        'Test1=Basic; expires=Wed, 13-Jan-2021 22:23:01 GMT',
        'Test2=PathMatch; expires=Wed, 13-Jan-2021 22:23:01 GMT; path=/TestPath',
        'Test3=DomainMatch; expires=Wed, 13-Jan-2021 22:23:01 GMT; domain=.dc5f4ce48f6.com',
        'Test4=HttpOnly; expires=Wed, 13-Jan-2021 22:23:01 GMT; path=/; HttpOnly',
        'Test5=Secure; expires=Wed, 13-Jan-2021 22:23:01 GMT; path=/; Secure',
        'Test6=Duplicate; One=More; expires=Wed, 13-Jan-2021 22:23:01 GMT; path=/'
    ];

    var expectedResults = [
        {
            'key':     'Test1',
            'value':   'Basic',
            'expires': 'Wed, 13-Jan-2021 22:23:01 GMT'
        },
        {
            'key':     'Test2',
            'value':   'PathMatch',
            'expires': 'Wed, 13-Jan-2021 22:23:01 GMT',
            'path':    '/TestPath'
        },
        {
            'key':     'Test3',
            'value':   'DomainMatch',
            'expires': 'Wed, 13-Jan-2021 22:23:01 GMT',
            'domain':  'dc5f4ce48f6.com'
        },

        {
            'key':      'Test4',
            'value':    'HttpOnly',
            'expires':  'Wed, 13-Jan-2021 22:23:01 GMT',
            'path':     '/',
            'httponly': true
        },
        {
            'key':     'Test5',
            'value':   'Secure',
            'expires': 'Wed, 13-Jan-2021 22:23:01 GMT',
            'path':    '/',
            'secure':  true
        },
        {
            'key':     'Test6',
            'value':   'Duplicate',
            'expires': 'Wed, 13-Jan-2021 22:23:01 GMT',
            'path':    '/'
        }
    ];

    for (var i = 0; i < cookieStrs.length; i++) {
        var parsedCookie = CookieUtil.parse(cookieStrs[i]);

        deepEqual(parsedCookie, expectedResults[i]);
    }

});

//NOTE: we can't guarantee order of keys in serialized cookie string, so we use
//format-parse technique to test cookie formatting
test('format-parse', function () {
    var parsedCookies = [
        {
            'key':     'Test1',
            'value':   'Basic',
            'expires': 'Wed, 13-Jan-2021 22:23:01 GMT'
        },
        {
            'key':     'Test2',
            'value':   'PathMatch',
            'expires': 'Wed, 13-Jan-2021 22:23:01 GMT',
            'path':    '/TestPath'
        },
        {
            'key':     'Test3',
            'value':   'DomainMatch',
            'expires': 'Wed, 13-Jan-2021 22:23:01 GMT',
            'domain':  'dc5f4ce48f6.com'
        },

        {
            'key':      'Test4',
            'value':    'HttpOnly',
            'expires':  'Wed, 13-Jan-2021 22:23:01 GMT',
            'path':     '/',
            'httponly': true
        },
        {
            'key':     'Test5',
            'value':   'Secure',
            'expires': 'Wed, 13-Jan-2021 22:23:01 GMT',
            'path':    '/',
            'secure':  true
        },
        {
            'key':     'Test6',
            'value':   'Duplicate',
            'expires': 'Wed, 13-Jan-2021 22:23:01 GMT',
            'path':    '/'
        }
    ];

    for (var i = 0; i < parsedCookies.length; i++) {
        var formattedCookie = CookieUtil.format(parsedCookies[i]);

        deepEqual(CookieUtil.parse(formattedCookie), parsedCookies[i]);
    }
});

test('get cookie string and delete cookie', function () {
    var cookieName = 'Test' + Math.round(new Date().getTime() / (3600 * 1000));
    var cookieStr  = cookieName + '=42';

    document.cookie = cookieStr;

    strictEqual(CookieUtil.get(document, cookieName), cookieStr);

    CookieUtil.del(document, CookieUtil.parse(cookieStr));
    ok(!CookieUtil.get(document, cookieName));
});

