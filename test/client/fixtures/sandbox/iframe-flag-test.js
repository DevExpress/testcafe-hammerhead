var urlUtils = hammerhead.get('./utils/url');
var settings = hammerhead.get('./settings');

var iframeSandbox = hammerhead.sandbox.iframe;
var nativeMethods = hammerhead.nativeMethods;
var browserUtils  = hammerhead.utils.browser;

QUnit.testStart(function () {
    // NOTE: The 'window.open' method used in QUnit.
    window.open       = nativeMethods.windowOpen;
    window.setTimeout = nativeMethods.setTimeout;
    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT_EVENT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, initIframeTestHandler);
});

function hasIframeFlag (url) {
    var resourceType = urlUtils.parseProxyUrl(url).resourceType;

    return !!resourceType && resourceType.indexOf('i') !== -1;
}

function provokeTargetCalculation (link) {
    link.click();
}

var tagUrlAttr = {
    a:    'href',
    form: 'action',
    area: 'href',
    base: 'href'
};

function testIframeFlagViaAttrs (doc, iframeFlagResults) {
    var url                   = 'https://example.com/';
    var hasIframeFlagByTarget = function (tagName, targetValue) {
        return tagName === 'base' ? false : iframeFlagResults[targetValue];
    };

    Object.keys(tagUrlAttr).forEach(function (tagName) {
        var el      = doc.createElement(tagName);
        var urlAttr = tagUrlAttr[tagName];

        doc.body.appendChild(el);

        Object.keys(iframeFlagResults).forEach(function (targetValue, index, keys) {
            setProperty(el, 'target', targetValue);
            setProperty(el, urlAttr, url);

            strictEqual(hasIframeFlag(el[urlAttr]), hasIframeFlagByTarget(tagName, targetValue),
                tagName + ' target=' + targetValue);

            var nextTargetValue = keys[(index + 1) % keys.length];

            setProperty(el, 'target', nextTargetValue);

            strictEqual(hasIframeFlag(el[urlAttr]), hasIframeFlagByTarget(tagName, nextTargetValue),
                tagName + ' target=' + nextTargetValue);
        });

        doc.body.removeChild(el);
    });
}

module('target');

test('assign a url attribute to elements with the "target" attribute in top window', function () {
    return window.createTestIframe({ name: 'window_name' })
        .then(function () {
            /* eslint-disable camelcase */
            testIframeFlagViaAttrs(document, {
                _blank:        false,
                _self:         false,
                _parent:       false,
                _top:          false,
                window_name:   true,
                unknow_window: false
            });
            /* eslint-enable camelcase */
        });
});

test('assign a url attribute to elements with the "target" attribute in iframe', function () {
    // NOTE: Firefox doesn't raise the 'load' event for double-nested iframes without src
    var src          = browserUtils.isFirefox ? 'javascript:"<html><body></body></html>"' : '';
    var parentIframe = null;

    return window.createTestIframe(src)
        .then(function (iframe) {
            parentIframe = iframe;

            return window.createTestIframe({ name: 'window_name' }, iframe.contentDocument.body);
        })
        .then(function () {
            /* eslint-disable camelcase */
            testIframeFlagViaAttrs(parentIframe.contentDocument, {
                _blank:        false,
                _self:         true,
                _parent:       false,
                _top:          false,
                window_name:   true,
                unknow_window: false
            });
            /* eslint-enable camelcase */
        });
});

test('assign a url attribute to elements with the "target" attribute in embedded iframe', function () {
    // NOTE: Firefox doesn't raise the 'load' event for double-nested iframes without src
    var src            = browserUtils.isFirefox ? 'javascript:"<html><body></body></html>"' : '';
    var embeddedIframe = null;

    return window.createTestIframe(src)
        .then(function (iframe) {
            return window.createTestIframe(null, iframe.contentDocument.body);
        })
        .then(function (iframe) {
            embeddedIframe = iframe;

            return window.createTestIframe({
                src:  window.getSameDomainPageUrl('../../data/iframe/simple-iframe.html'),
                name: 'window_name'
            }, embeddedIframe.contentDocument.body);
        })
        .then(function () {
            /* eslint-disable camelcase */
            testIframeFlagViaAttrs(embeddedIframe.contentDocument, {
                _blank:        false,
                _self:         true,
                _parent:       true,
                _top:          false,
                window_name:   true,
                unknow_window: false
            });
            /* eslint-enable camelcase */
        });
});

test('move elements between windows (GH-564)', function () {
    return window.createTestIframe()
        .then(function (iframe) {
            var iframeDocument = iframe.contentDocument;

            Object.keys(tagUrlAttr).forEach(function (tagName) {
                var el      = document.createElement(tagName);
                var urlAttr = tagUrlAttr[tagName];

                document.body.appendChild(el);

                setProperty(el, urlAttr, 'https://example.com/');

                strictEqual(hasIframeFlag(el[urlAttr]), false, tagName + ' into top window');

                document.body.removeChild(el);
                iframeDocument.body.appendChild(el);

                strictEqual(hasIframeFlag(el[urlAttr]), tagName !== 'base', tagName + ' into iframe');

                iframeDocument.body.removeChild(el);
                document.body.appendChild(el);

                strictEqual(hasIframeFlag(el[urlAttr]), false, tagName + ' into top window');

                document.body.removeChild(el);
            });

            document.body.removeChild(iframe);
        });
});

test('change iframe name', function () {
    var url    = 'https://example.com/';
    var iframe = document.createElement('iframe');
    var a      = document.createElement('a');

    iframe.id   = 'test' + Date.now();
    iframe.name = 'window_name_first';

    a.setAttribute('onclick', 'return false;');

    document.body.appendChild(iframe);
    document.body.appendChild(a);

    setProperty(a, 'target', 'window_name_first');
    setProperty(a, 'href', url);

    ok(hasIframeFlag(a.href));

    iframe.contentWindow.name = 'window_name_second';

    provokeTargetCalculation(a);

    ok(!hasIframeFlag(a.href));

    iframe.contentWindow.name = 'window_name_first';

    provokeTargetCalculation(a);

    ok(hasIframeFlag(a.href));

    document.body.removeChild(iframe);
    document.body.removeChild(a);
});

// TODO
//test('change the "target" attribute in the "base" tag', function () {
//    var url    = 'https://example.com/';
//    var iframe = document.createElement('iframe');
//    var base   = document.createElement('base');
//    var a      = document.createElement('a');
//
//    iframe.id   = 'test' + Date.now();
//    iframe.name = 'window_name';
//
//    setProperty(base, 'target', 'window_name');
//
//    document.head.appendChild(base);
//    document.body.appendChild(iframe);
//    document.body.appendChild(a);
//
//    setProperty(a, 'href', url);
//
//    ok(hasIframeFlag(a.href));
//
//    setProperty(base, 'target', 'unknow_window');
//
//    ok(!hasIframeFlag(a.href));
//
//    setProperty(base, 'target', 'window_name');
//
//    ok(hasIframeFlag(a.href));
//
//    document.head.removeChild(base);
//    document.body.removeChild(iframe);
//    document.body.removeChild(a);
//});

module('location');

test('change a url via location from cross-domain window', function () {
    hammerhead.sandbox.codeInstrumentation.methodCallInstrumentation.methodWrappers.assign.method({
        assign: function (url) {
            ok(hasIframeFlag(url));
        }
    }, ['https://example.com/']);

    hammerhead.sandbox.codeInstrumentation.methodCallInstrumentation.methodWrappers.replace.method({
        replace: function (url) {
            ok(hasIframeFlag(url));
        }
    }, ['https://example.com/']);
});

module('regression');

test('setAttribute: frame src (GH-1070)', function () {
    var frame    = document.createElement('frame');
    var proxyUrl = 'http://' + location.hostname + ':' + settings.get().crossDomainProxyPort +
                   '/sessionId!i/https://example.com/';

    frame.setAttribute('src', 'https://example.com/');

    strictEqual(nativeMethods.getAttribute.call(frame, 'src'), proxyUrl);
});
