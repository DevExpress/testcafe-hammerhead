var INTERNAL_ATTRS = Hammerhead.get('../processing/dom/internal-attributes');
var settings       = Hammerhead.get('./settings');
var sharedUrlUtils = Hammerhead.get('../utils/url');

var xhrSandbox = Hammerhead.sandbox.xhr;

test('redirect requests to proxy', function () {
    jQuery.ajaxSetup({ async: false });

    $.get('/xhr-test/100', function (url) {
        strictEqual(url, '/sessionId/https://example.com/xhr-test/100');
    });

    $.get('http://' + window.location.host + '/xhr-test/200', function (url) {
        strictEqual(url, '/sessionId/https://example.com/xhr-test/200');
    });

    $.get('https://example.com/xhr-test/300', function (url) {
        strictEqual(url, '/sessionId/https://example.com/xhr-test/300');
    });

    jQuery.ajaxSetup({ async: true });
});

asyncTest('unsupported protocol', function () {
    var unsupportedUrl = 'gopher://test.domain/';

    var handler = function (e) {
        strictEqual(e.err.code, sharedUrlUtils.URL_UTIL_PROTOCOL_IS_NOT_SUPPORTED);
        strictEqual(e.err.originUrl, unsupportedUrl);
        xhrSandbox.off(xhrSandbox.XHR_ERROR_EVENT, handler);
        start();
    };

    xhrSandbox.on(xhrSandbox.XHR_ERROR_EVENT, handler);

    var request = new XMLHttpRequest();

    request.open('GET', unsupportedUrl, true);
});

asyncTest('service message is not processed by a page processor', function () {
    var storedServiceUrl = settings.get().serviceMsgUrl;

    settings.get().serviceMsgUrl = '/service-msg/100';

    var handler = function (data) {
        ok(data.indexOf(INTERNAL_ATTRS.storedAttrPostfix) === -1);
        settings.get().serviceMsgUrl = storedServiceUrl;
        start();
    };

    $.post(settings.get().serviceMsgUrl, handler);
});

module('regression');

asyncTest('Unexpected text modifying during typing text in the search input on the http://www.google.co.uk (B238528)', function () {
    var timeout = 100;

    var ready = function () {
        if (this.readyState === this.DONE) {
            ok(syncActionExecuted);
            start();
        }
    };

    var syncActionExecuted = false;

    var xhr = new XMLHttpRequest();

    xhr.onreadystatechange = ready;
    xhr.open('GET', '/xhr-test/' + timeout);
    xhr.send(null);

    syncActionExecuted = true;
});

asyncTest('parameters must pass correctly in xhr event handlers (T239198)', function () {
    var request = new XMLHttpRequest();

    // NOTE: check XHR is wrapped
    ok(request.hasOwnProperty('addEventListener'));

    request.addEventListener('progress', function (e) {
        ok(e.target);
    }, true);

    request.addEventListener('load', function (e) {
        ok(e.target);
        start();
    }, true);

    request.addEventListener('error', function () {
        ok(false);
    });

    request.open('GET', '/xhr-large-response', true);
    request.send(null);
});
