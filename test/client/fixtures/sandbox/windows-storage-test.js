var windowStorage = hammerhead.sandbox.windowStorage;

test('iframe', function () {
    var iframe = document.createElement('iframe');

    iframe.id   = 'test_unique_id_ea366my0l';
    iframe.name = 'test_iframe';
    document.body.appendChild(iframe);

    ok(windowStorage.findByName('test_iframe'));
    ok(!windowStorage.findByName('wrong_iframe_name'));

    iframe.parentNode.removeChild(iframe);

    ok(!windowStorage.findByName('test_iframe'));
});

test('top window', function () {
    var storedWindowName = window.name;

    window.name = 'test_top_window';

    ok(windowStorage.findByName('test_top_window'));
    ok(!windowStorage.findByName('non_existing_window_name'));

    window.name = storedWindowName;
});

module('regression');

test('should not raise an error for a cross-domain iframe (GH-669)', function () {
    var src = '../../data/code-instrumentation/iframe.html';

    return createTestIframe({ src: getCrossDomainPageUrl(src) })
        .then(function () {
            return createTestIframe({
                src:  getSameDomainPageUrl(src),
                name: 'same_domain_iframe',
            });
        })
        .then(function () {
            ok(windowStorage.findByName('same_domain_iframe'));
        });
});
