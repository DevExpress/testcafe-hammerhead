var urlUtils = hammerhead.get('./utils/url');

var iframeSandbox = hammerhead.sandbox.iframe;
var nativeMethods = hammerhead.nativeMethods;
var browserUtils  = hammerhead.utils.browser;

QUnit.testStart(function () {
    // NOTE: The 'window.open' method used in QUnit.
    window.open       = nativeMethods.windowOpen;
    window.setTimeout = nativeMethods.setTimeout;
    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
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
    var iframe = document.createElement('iframe');

    iframe.id   = 'test' + Date.now();
    iframe.name = 'window_name';
    document.body.appendChild(iframe);

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

    document.body.removeChild(iframe);
});

asyncTest('assign a url attribute to elements with the "target" attribute in iframe', function () {
    var iframe = document.createElement('iframe');

    iframe.id = 'test' + Date.now();

    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            var iframeDocument = iframe.contentDocument;
            var embeddedIframe = iframeDocument.createElement('iframe');

            embeddedIframe.id   = 'test' + Date.now();
            embeddedIframe.name = 'window_name';
            iframeDocument.body.appendChild(embeddedIframe);

            /* eslint-disable camelcase */
            testIframeFlagViaAttrs(iframeDocument, {
                _blank:        false,
                _self:         true,
                _parent:       false,
                _top:          false,
                window_name:   true,
                unknow_window: false
            });
            /* eslint-enable camelcase */

            iframeDocument.body.removeChild(embeddedIframe);
            document.body.removeChild(iframe);

            start();
        });

    document.body.appendChild(iframe);
});

asyncTest('assign a url attribute to elements with the "target" attribute in embedded iframe', function () {
    // NOTE: Firefox doesn't raise the 'load' event for double-nested iframes without src
    var src            = browserUtils.isFirefox ? 'javascript:"<html><body></body></html>"' : '';
    var iframe         = document.createElement('iframe');
    var embeddedIframe = null;

    iframe.id = 'test' + Date.now();
    iframe.setAttribute('src', src);

    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            var iframeDocument      = iframe.contentDocument;
            var iframeHammerhead    = iframe.contentWindow['%hammerhead%'];
            var iframeIframeSandbox = iframeHammerhead.sandbox.iframe;

            iframeIframeSandbox.on(iframeIframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
            iframeIframeSandbox.off(iframeIframeSandbox.RUN_TASK_SCRIPT, iframeSandbox.iframeReadyToInitHandler);

            embeddedIframe = iframeDocument.createElement('iframe');

            embeddedIframe.id = 'test' + Date.now();

            iframeDocument.body.appendChild(embeddedIframe);

            return window.QUnitGlobals.waitForIframe(embeddedIframe);
        })
        .then(function () {
            var embeddedIframeDocument = embeddedIframe.contentDocument;
            var otherIframe            = embeddedIframeDocument.createElement('iframe');

            otherIframe.id   = 'test' + Date.now();
            otherIframe.name = 'window_name';
            embeddedIframeDocument.body.appendChild(otherIframe);

            /* eslint-disable camelcase */
            testIframeFlagViaAttrs(embeddedIframeDocument, {
                _blank:        false,
                _self:         true,
                _parent:       true,
                _top:          false,
                window_name:   true,
                unknow_window: false
            });
            /* eslint-enable camelcase */

            embeddedIframeDocument.body.removeChild(otherIframe);
            iframe.contentDocument.body.removeChild(embeddedIframe);
            document.body.removeChild(iframe);
            start();
        });

    document.body.appendChild(iframe);
});

// TODO: GH-564
//asyncTest('move elements between windows', function () {
//    var iframe = document.createElement('iframe');
//
//    iframe.id = 'test' + Date.now();
//
//    window.QUnitGlobals.waitForIframe(iframe)
//        .then(function () {
//            var iframeDocument = iframe.contentDocument;
//
//            Object.keys(tagUrlAttr).forEach(function (tagName) {
//                var el      = document.createElement(tagName);
//                var urlAttr = tagUrlAttr[tagName];
//
//                document.body.appendChild(el);
//
//                setProperty(el, urlAttr, 'https://example.com/');
//
//                strictEqual(hasIframeFlag(el[urlAttr]), false, tagName + ' into top window');
//
//                document.body.removeChild(el);
//                iframeDocument.body.appendChild(el);
//
//                strictEqual(hasIframeFlag(el[urlAttr]), tagName !== 'base', tagName + ' into iframe');
//
//                iframeDocument.body.removeChild(el);
//                document.body.appendChild(el);
//
//                strictEqual(hasIframeFlag(el[urlAttr]), false, tagName + ' into top window');
//
//                document.body.removeChild(el);
//            });
//
//            document.body.removeChild(iframe);
//            start();
//        });
//
//    document.body.appendChild(iframe);
//});

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

asyncTest('change a url via location from cross-domain window', function () {
    var iframe = document.createElement('iframe');

    iframe.id  = 'test' + Date.now();
    iframe.src = window.getCrossDomainPageUrl('../../../data/cross-domain/target-url.html');

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

    start();
});
