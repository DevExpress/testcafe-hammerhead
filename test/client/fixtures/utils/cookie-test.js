var cookieUtil = hammerhead.get('./utils/cookie');

test('parse', function () {
    deepEqual(cookieUtil.parse('Test1=Basic; expires=Wed, 13 Jan 2021 22:23:01 GMT'), {
        key:     'Test1',
        value:   'Basic',
        expires: new Date('Wed, 13 Jan 2021 22:23:01 GMT')
    });

    deepEqual(cookieUtil.parse('Test2=PathMatch; expires=Wed, 13 Jan 2021 22:23:01 GMT; path=/TestPath'), {
        key:     'Test2',
        value:   'PathMatch',
        expires: new Date('Wed, 13 Jan 2021 22:23:01 GMT'),
        path:    '/TestPath'
    });

    deepEqual(cookieUtil.parse('Test3=DomainMatch; expires=Wed, 13 Jan 2021 22:23:01 GMT; domain=.dc5f4ce48f6.com'), {
        key:     'Test3',
        value:   'DomainMatch',
        expires: new Date('Wed, 13 Jan 2021 22:23:01 GMT'),
        domain:  'dc5f4ce48f6.com'
    });

    deepEqual(cookieUtil.parse('Test4=HttpOnly; expires=Wed, 13 Jan 2021 22:23:01 GMT; path=/; HttpOnly'), {
        key:      'Test4',
        value:    'HttpOnly',
        expires:  new Date('Wed, 13 Jan 2021 22:23:01 GMT'),
        path:     '/',
        httpOnly: true
    });

    deepEqual(cookieUtil.parse('Test5=Secure; expires=Wed, 13 Jan 2021 22:23:01 GMT; path=/; Secure'), {
        key:     'Test5',
        value:   'Secure',
        expires: new Date('Wed, 13 Jan 2021 22:23:01 GMT'),
        path:    '/',
        secure:  true
    });

    deepEqual(cookieUtil.parse('Test6=Duplicate; One=More; expires=Wed, 13 Jan 2021 22:23:01 GMT; path=/'), {
        key:     'Test6',
        value:   'Duplicate',
        expires: new Date('Wed, 13 Jan 2021 22:23:01 GMT'),
        path:    '/'
    });

    deepEqual(cookieUtil.parse('Test7=Duplicate; Max-Age=35; path=/'), {
        key:    'Test7',
        value:  'Duplicate',
        maxAge: '35',
        path:   '/'
    });
});

test('formatClientString', function () {
    strictEqual(cookieUtil.formatClientString({
        key:     'Test1',
        value:   'Basic',
        expires: new Date('Wed, 13 Jan 2021 22:23:01 GMT'),
        secure:  true
    }), 'Test1=Basic');

    strictEqual(cookieUtil.formatClientString({
        key:   '',
        value: 'Basic'
    }), 'Basic');

    strictEqual(cookieUtil.formatClientString({
        key:   '',
        value: ''
    }), '');
});

test('domainMatch', function () {
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
    ok(cookieUtil.pathMatch('/', '/'));
    ok(cookieUtil.pathMatch('/path', '/'));
    ok(cookieUtil.pathMatch('/path', '/path'));
    ok(cookieUtil.pathMatch('/path/some', '/path'));
    ok(cookieUtil.pathMatch('/path/some', '/path/'));

    notOk(cookieUtil.pathMatch('/path/some', '/some'));
    notOk(cookieUtil.pathMatch('/path/some', '123'));
    notOk(cookieUtil.pathMatch('/path/some', '/path/some/123'));
    notOk(cookieUtil.pathMatch('/path/some', '/path/some/'));
});
