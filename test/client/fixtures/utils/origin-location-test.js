var destLocation = hammerhead.utils.destLocation;

test('sameOriginCheck', function () {
    ok(destLocation.sameOriginCheck('http://proxy/token!uid/http://origin.com:111/index.html', 'http://origin.com:111/index.php'));
    ok(destLocation.sameOriginCheck('http://proxy/token!uid/http://sub.origin.com:111/index.html', 'http://proxy/index.php'));
    ok(destLocation.sameOriginCheck('http://proxy/token!uid/https://origin.com:111/index.html', '//origin.com:111/index.php'));
    ok(destLocation.sameOriginCheck('http://sub.origin.com/index.html', 'http://sub.origin.com/'));
    ok(!destLocation.sameOriginCheck('http://proxy/token!uid/http://origin.com:111/index.html', 'http://sub.origin.com:111/index.php'));
    ok(!destLocation.sameOriginCheck('http://proxy/token!uid/http://origin.com:111/index.html', 'http://sub1.sub2.origin.com:111/index.php'));
    ok(!destLocation.sameOriginCheck('http://proxy/token!uid/http://sub.origin.com:111/index.html', 'http://origin.com:111/index.php'));
    ok(!destLocation.sameOriginCheck('http://proxy/token!uid/http://www.origin.com/index.html', 'http://origin.com/'));
    ok(!destLocation.sameOriginCheck('http://proxy/token!uid/http://origin.com:111/index.html', 'http://origin.com/index.php'));
    ok(!destLocation.sameOriginCheck('http://proxy/token!uid/http://sub.origin.com:111/index.html', 'http://location:111/index.php'));
    ok(!destLocation.sameOriginCheck('http://proxy/token!uid/http://sub.origin.com:111/index.html', 'https://location/index.php'));
    ok(!destLocation.sameOriginCheck('http://proxy/token!uid/http://origin.com:111/index.html', 'http://origin.com:222/index.php'));
    ok(!destLocation.sameOriginCheck('http://proxy/token!uid/http://origin.com:111/index.html', 'https://origin.com:111/index.php'));
    ok(!destLocation.sameOriginCheck('http://proxy/token!uid/http://origin.com:111/index.html', 'http://origin2.com:111/index.php'));
    ok(!destLocation.sameOriginCheck('http://proxy/token!uid/http://www.origin.com:111/index.html', 'http://origin.com:111/index.php'));
    ok(!destLocation.sameOriginCheck('http://proxy/token!uid/http://www.example.com', 'http://money.example.com'));
});

test('resolveUrl', function () {
    strictEqual(destLocation.resolveUrl('//domain.com/index.php'), 'https://domain.com/index.php');
    strictEqual(destLocation.resolveUrl('//dom\n\tain.com/index.php'), 'https://domain.com/index.php');
    strictEqual(destLocation.resolveUrl(location), location.toString());
});
