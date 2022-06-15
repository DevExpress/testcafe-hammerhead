var cookieUtil = hammerhead.utils.cookie;

var validDate    = new Date((Math.floor(Date.now() / 1000) + 60) * 1000);
var validDateStr = validDate.toUTCString();

test('parse', function () {
    deepEqual(cookieUtil.parse('Test1=Basic; expires=' + validDateStr), {
        key:     'Test1',
        value:   'Basic',
        expires: validDate,
    });

    deepEqual(cookieUtil.parse('Test2=PathMatch; expires=' + validDateStr + '; path=/TestPath'), {
        key:     'Test2',
        value:   'PathMatch',
        expires: validDate,
        path:    '/TestPath',
    });

    deepEqual(cookieUtil.parse('Test3=DomainMatch; expires=' + validDateStr + '; domain=.dc5f4ce48f6.com'), {
        key:     'Test3',
        value:   'DomainMatch',
        expires: validDate,
        domain:  'dc5f4ce48f6.com',
    });

    deepEqual(cookieUtil.parse('Test4=HttpOnly; expires=' + validDateStr + '; path=/; HttpOnly'), {
        key:      'Test4',
        value:    'HttpOnly',
        expires:  validDate,
        path:     '/',
        httpOnly: true,
    });

    deepEqual(cookieUtil.parse('Test5=Secure; expires=' + validDateStr + '; path=/; Secure'), {
        key:     'Test5',
        value:   'Secure',
        expires: validDate,
        path:    '/',
        secure:  true,
    });

    deepEqual(cookieUtil.parse('Test6=Duplicate; One=More; expires=' + validDateStr + '; path=/'), {
        key:     'Test6',
        value:   'Duplicate',
        expires: validDate,
        path:    '/',
    });

    deepEqual(cookieUtil.parse('Test7=Duplicate; Max-Age=35; path=/'), {
        key:    'Test7',
        value:  'Duplicate',
        maxAge: 35,
        path:   '/',
    });
});

test('formatClientString', function () {
    strictEqual(cookieUtil.formatClientString({
        key:     'Test1',
        value:   'Basic',
        expires: validDate,
        secure:  true,
    }), 'Test1=Basic');

    strictEqual(cookieUtil.formatClientString({
        key:   '',
        value: 'Basic',
    }), 'Basic');

    strictEqual(cookieUtil.formatClientString({
        key:   '',
        value: '',
    }), '');
});

test('domainMatch', function () {
    ok(cookieUtil.domainMatch('sub.example.com', void 0));
    ok(cookieUtil.domainMatch('sub.example.com', 'sub.example.com'));
    ok(cookieUtil.domainMatch('sub.example.com', 'SUB.Example.com'));
    ok(cookieUtil.domainMatch('sub.example.com', 'example.com'));

    notOk(cookieUtil.domainMatch('sub.example.com', '123'));
    notOk(cookieUtil.domainMatch('sub.example.com', 'sub.example'));
    notOk(cookieUtil.domainMatch('sub.example.com', 'example.co'));
    notOk(cookieUtil.domainMatch('sub.example.com', 'b.example.com'));
    notOk(cookieUtil.domainMatch('sub.example.com', 'sub.sub.example.com'));
});

test('pathMatch', function () {
    ok(cookieUtil.pathMatch('/', void 0));
    ok(cookieUtil.pathMatch('/', '/'));
    ok(cookieUtil.pathMatch('/path', '/'));
    ok(cookieUtil.pathMatch('/path', '/path'));
    ok(cookieUtil.pathMatch('/path/some', '/path'));
    ok(cookieUtil.pathMatch('/path/some', '/path/'));
    ok(cookieUtil.pathMatch('/path/some', '123'));

    notOk(cookieUtil.pathMatch('/path/some', '/123'));
    notOk(cookieUtil.pathMatch('/path/some', '/some'));
    notOk(cookieUtil.pathMatch('/path/some', '/path/some/123'));
    notOk(cookieUtil.pathMatch('/path/some', '/path/some/'));
});

test('setDefaultValues', function () {
    var parsedCookie = { key: 'test', value: 'test' };

    cookieUtil.setDefaultValues(parsedCookie, { hostname: 'example.com', pathname: '/' });

    deepEqual(parsedCookie, {
        key:     'test',
        value:   'test',
        domain:  'example.com',
        path:    '/',
        expires: 'Infinity',
        maxAge:  'Infinity',
    });

    parsedCookie = { key: 'test', value: 'test' };

    cookieUtil.setDefaultValues(parsedCookie, { hostname: 'example.com', pathname: '/path' });

    deepEqual(parsedCookie, {
        key:     'test',
        value:   'test',
        domain:  'example.com',
        path:    '/',
        expires: 'Infinity',
        maxAge:  'Infinity',
    });

    parsedCookie = { key: 'test', value: 'test' };

    cookieUtil.setDefaultValues(parsedCookie, { hostname: 'example.com', pathname: '/path/' });

    deepEqual(parsedCookie, {
        key:     'test',
        value:   'test',
        domain:  'example.com',
        path:    '/path',
        expires: 'Infinity',
        maxAge:  'Infinity',
    });

    parsedCookie = { key: 'test', value: 'test', path: '/path' };

    cookieUtil.setDefaultValues(parsedCookie, { hostname: 'example.com', pathname: '/' });

    deepEqual(parsedCookie, {
        key:     'test',
        value:   'test',
        domain:  'example.com',
        path:    '/path',
        expires: 'Infinity',
        maxAge:  'Infinity',
    });

    parsedCookie = { key: 'test', value: 'test', path: '123' };

    cookieUtil.setDefaultValues(parsedCookie, { hostname: 'example.com', pathname: '/path/example' });

    deepEqual(parsedCookie, {
        key:     'test',
        value:   'test',
        domain:  'example.com',
        path:    '/path',
        expires: 'Infinity',
        maxAge:  'Infinity',
    });

    parsedCookie = { key: 'test', value: 'test', domain: 'localhost' };

    cookieUtil.setDefaultValues(parsedCookie, { hostname: 'example.com', pathname: '/path/example' });

    deepEqual(parsedCookie, {
        key:     'test',
        value:   'test',
        domain:  'localhost',
        path:    '/path',
        expires: 'Infinity',
        maxAge:  'Infinity',
    });

    parsedCookie = { key: 'test', value: 'test', expires: new Date() };

    cookieUtil.setDefaultValues(parsedCookie, { hostname: 'example.com', pathname: '/path/example' });

    deepEqual(parsedCookie, {
        key:     'test',
        value:   'test',
        domain:  'example.com',
        path:    '/path',
        expires: parsedCookie.expires,
        maxAge:  'Infinity',
    });

    parsedCookie = { key: 'test', value: 'test', maxAge: 10 };

    cookieUtil.setDefaultValues(parsedCookie, { hostname: 'example.com', pathname: '/path/example' });

    deepEqual(parsedCookie, {
        key:     'test',
        value:   'test',
        domain:  'example.com',
        path:    '/path',
        expires: 'Infinity',
        maxAge:  parsedCookie.maxAge,
    });
});
