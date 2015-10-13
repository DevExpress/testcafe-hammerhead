var originLocation = Hammerhead.get('./utils/origin-location');

test('sameOriginCheck', function () {
    ok(originLocation.sameOriginCheck('http://proxy/token!uid/http://origin.com:111/index.html', 'http://origin.com:111/index.php'));
    ok(originLocation.sameOriginCheck('http://proxy/token!uid/http://origin.com:111/index.html', 'http://sub.origin.com:111/index.php'));
    ok(originLocation.sameOriginCheck('http://proxy/token!uid/http://origin.com:111/index.html', 'http://sub1.sub2.origin.com:111/index.php'));
    ok(originLocation.sameOriginCheck('http://proxy/token!uid/http://sub.origin.com:111/index.html', 'http://origin.com:111/index.php'));
    ok(originLocation.sameOriginCheck('http://proxy/token!uid/http://sub.origin.com:111/index.html', 'http://proxy/index.php'));
    ok(originLocation.sameOriginCheck('http://proxy/token!uid/http://www.origin.com/index.html', 'http://origin.com/'));
    ok(!originLocation.sameOriginCheck('http://proxy/token!uid/http://origin.com:111/index.html', 'http://origin.com/index.php'));
    ok(!originLocation.sameOriginCheck('http://proxy/token!uid/http://sub.origin.com:111/index.html', 'http://location:111/index.php'));
    ok(!originLocation.sameOriginCheck('http://proxy/token!uid/http://sub.origin.com:111/index.html', 'https://location/index.php'));
    ok(!originLocation.sameOriginCheck('http://proxy/token!uid/http://origin.com:111/index.html', 'http://origin.com:222/index.php'));
    ok(!originLocation.sameOriginCheck('http://proxy/token!uid/http://origin.com:111/index.html', 'https://origin.com:111/index.php'));
    ok(!originLocation.sameOriginCheck('http://proxy/token!uid/http://origin.com:111/index.html', 'http://origin2.com:111/index.php'));
});

test('resolveUrl', function () {
    strictEqual(originLocation.resolveUrl('//domain.com/index.php'), 'https://domain.com/index.php');
    strictEqual(originLocation.resolveUrl('//dom\n\tain.com/index.php'), 'https://domain.com/index.php');
    strictEqual(originLocation.resolveUrl(location), location.toString());
});
