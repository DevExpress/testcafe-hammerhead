var urlUtils = hammerhead.utils.url;
var settings = hammerhead.settings;

var nativeMethods = hammerhead.nativeMethods;
var browserUtils  = hammerhead.utils.browser;

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
    base: 'href',
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
            el.target   = targetValue;
            el[urlAttr] = url;

            strictEqual(hasIframeFlag(nativeMethods.getAttribute.call(el, urlAttr)),
                hasIframeFlagByTarget(tagName, targetValue),
                tagName + ' target=' + targetValue);

            var nextTargetValue = keys[(index + 1) % keys.length];

            el.target = nextTargetValue;

            strictEqual(hasIframeFlag(nativeMethods.getAttribute.call(el, urlAttr)),
                hasIframeFlagByTarget(tagName, nextTargetValue),
                tagName + ' target=' + nextTargetValue);
        });

        doc.body.removeChild(el);
    });
}

var tagFormTargetAttr = {
    input:  'formAction',
    button: 'formAction',
};

function testIframeFlagViaFormTarget (doc, iframeFlagResults) {
    var url                   = 'https://example.com/';
    var hasIframeFlagByTarget = function (tagName, targetValue) {
        return iframeFlagResults[targetValue];
    };

    Object.keys(tagFormTargetAttr).forEach(function (tagName) {
        var el      = doc.createElement(tagName);
        var urlAttr = tagFormTargetAttr[tagName];
        var form;

        form = doc.createElement('form');
        doc.body.appendChild(form);
        form.appendChild(el);

        Object.keys(iframeFlagResults).forEach(function (targetValue, index, keys) {
            el.formTarget = targetValue;
            el[urlAttr]   = url;

            strictEqual(hasIframeFlag(nativeMethods.getAttribute.call(el, urlAttr)),
                hasIframeFlagByTarget(tagName, targetValue),
                tagName + ' formtarget=' + targetValue);

            var nextTargetValue = keys[(index + 1) % keys.length];

            el.formTarget = nextTargetValue;

            strictEqual(hasIframeFlag(nativeMethods.getAttribute.call(el, urlAttr)),
                hasIframeFlagByTarget(tagName, nextTargetValue),
                tagName + ' formtarget=' + nextTargetValue);
        });

        doc.body.removeChild(form);
    });
}

module('target');

test('assign a url attribute to elements with the "target" attribute in top window', function () {
    return createTestIframe({ name: 'window_name' })
        .then(function () {
            /* eslint-disable camelcase */
            testIframeFlagViaAttrs(document, {
                _blank:        false,
                _self:         false,
                _parent:       false,
                _top:          false,
                window_name:   true,
                unknow_window: false,
            });
            /* eslint-enable camelcase */
        });
});

test('assign a url attribute to elements with the "target" attribute in iframe', function () {
    // NOTE: Firefox doesn't raise the 'load' event for double-nested iframes without src
    var src          = browserUtils.isFirefox ? 'javascript:"<html><body></body></html>"' : '';
    var parentIframe = null;

    return createTestIframe({ src: src })
        .then(function (iframe) {
            parentIframe = iframe;

            return createTestIframe({ name: 'window_name' }, iframe.contentDocument.body);
        })
        .then(function () {
            /* eslint-disable camelcase */
            testIframeFlagViaAttrs(parentIframe.contentDocument, {
                _blank:        false,
                _self:         true,
                _parent:       false,
                _top:          false,
                window_name:   true,
                unknow_window: false,
            });
            /* eslint-enable camelcase */
        });
});

test('assign a url attribute to elements with the "target" attribute in embedded iframe', function () {
    // NOTE: Firefox doesn't raise the 'load' event for double-nested iframes without src
    var src            = browserUtils.isFirefox ? 'javascript:"<html><body></body></html>"' : '';
    var embeddedIframe = null;

    return createTestIframe({ src: src })
        .then(function (iframe) {
            return createTestIframe(null, iframe.contentDocument.body);
        })
        .then(function (iframe) {
            embeddedIframe = iframe;

            return createTestIframe({
                src:  getSameDomainPageUrl('../../data/iframe/simple-iframe.html'),
                name: 'window_name',
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
                unknow_window: false,
            });
            /* eslint-enable camelcase */
        });
});

test('move elements between windows (GH-564)', function () {
    return createTestIframe()
        .then(function (iframe) {
            var iframeDocument = iframe.contentDocument;

            Object.keys(tagUrlAttr).forEach(function (tagName) {
                var el      = document.createElement(tagName);
                var urlAttr = tagUrlAttr[tagName];

                document.body.appendChild(el);

                el[urlAttr] = 'https://example.com/';

                strictEqual(hasIframeFlag(nativeMethods.getAttribute.call(el, urlAttr)), false, tagName + ' into top window');

                document.body.removeChild(el);
                iframeDocument.body.appendChild(el);

                strictEqual(hasIframeFlag(nativeMethods.getAttribute.call(el, urlAttr)), tagName !== 'base', tagName + ' into iframe');

                iframeDocument.body.removeChild(el);
                document.body.appendChild(el);

                strictEqual(hasIframeFlag(nativeMethods.getAttribute.call(el, urlAttr)), false, tagName + ' into top window');

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

    a.target = 'window_name_first';
    a.href   = url;

    ok(hasIframeFlag(nativeMethods.anchorHrefGetter.call(a)));

    iframe.contentWindow.name = 'window_name_second';

    provokeTargetCalculation(a);

    ok(!hasIframeFlag(nativeMethods.anchorHrefGetter.call(a)));

    iframe.contentWindow.name = 'window_name_first';

    provokeTargetCalculation(a);

    ok(hasIframeFlag(nativeMethods.anchorHrefGetter.call(a)));

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


module('formtarget');

test('assign a "formaction" attribute to elements with the "formtarget" attribute in top window', function () {
    return createTestIframe({ name: 'window_name' })
        .then(function () {
            /* eslint-disable camelcase */
            testIframeFlagViaFormTarget(document, {
                _blank:        false,
                _self:         false,
                _parent:       false,
                _top:          false,
                window_name:   true,
                unknow_window: false,
            });
            /* eslint-enable camelcase */
        });
});

test('assign a "formaction" attribute to elements with the "formtarget" attribute in iframe', function () {
    // NOTE: Firefox doesn't raise the 'load' event for double-nested iframes without src
    var src          = browserUtils.isFirefox ? 'javascript:"<html><body></body></html>"' : '';
    var parentIframe = null;

    return createTestIframe({ src: src })
        .then(function (iframe) {
            parentIframe = iframe;

            return createTestIframe({ name: 'window_name' }, iframe.contentDocument.body);
        })
        .then(function () {
            /* eslint-disable camelcase */
            testIframeFlagViaFormTarget(parentIframe.contentDocument, {
                _blank:        false,
                _self:         true,
                _parent:       false,
                _top:          false,
                window_name:   true,
                unknow_window: false,
            });
            /* eslint-enable camelcase */
        });
});

test('assign a "formaction" attribute to elements with the "formtarget" attribute in embedded iframe', function () {
    // NOTE: Firefox doesn't raise the 'load' event for double-nested iframes without src
    var src            = browserUtils.isFirefox ? 'javascript:"<html><body></body></html>"' : '';
    var embeddedIframe = null;

    return createTestIframe({ src: src })
        .then(function (iframe) {
            return createTestIframe(null, iframe.contentDocument.body);
        })
        .then(function (iframe) {
            embeddedIframe = iframe;

            return createTestIframe({
                src:  getSameDomainPageUrl('../../data/iframe/simple-iframe.html'),
                name: 'window_name',
            }, embeddedIframe.contentDocument.body);
        })
        .then(function () {
            /* eslint-disable camelcase */
            testIframeFlagViaFormTarget(embeddedIframe.contentDocument, {
                _blank:        false,
                _self:         true,
                _parent:       true,
                _top:          false,
                window_name:   true,
                unknow_window: false,
            });
            /* eslint-enable camelcase */
        });
});


module('location');

test('change a url via location from cross-domain window', function () {
    hammerhead.sandbox.codeInstrumentation._methodCallInstrumentation.methodWrappers.assign.method({
        assign: function (url) {
            ok(hasIframeFlag(url));
        },
    }, ['https://example.com/']);

    hammerhead.sandbox.codeInstrumentation._methodCallInstrumentation.methodWrappers.replace.method({
        replace: function (url) {
            ok(hasIframeFlag(url));
        },
    }, ['https://example.com/']);
});


module('pass the actual "processedContext" parameter to "processHTML" (GH-1680)');

test('document.write', function () {
    return createTestIframe()
        .then(function (iframe) {
            var iframeDocument = iframe.contentDocument;

            iframeDocument.open();
            iframeDocument.write('<form action="some-path.html" target="_parent"></form>');
            iframeDocument.close();

            var processedForm = iframeDocument.forms[0];

            ok(!hasIframeFlag(nativeMethods.getAttribute.call(processedForm, 'action')));
        });
});

test('Element.insertAdjacentHTML', function () {
    var parentDiv = document.createElement('div');
    var childDiv  = parentDiv.appendChild(document.createElement('div'));

    document.body.appendChild(parentDiv);

    childDiv.insertAdjacentHTML('beforebegin', '<form action="some-path.html" target="_parent"></form>');

    var processedForm = parentDiv.querySelector('form');

    ok(!hasIframeFlag(nativeMethods.getAttribute.call(processedForm, 'action')));

    parentDiv.parentNode.removeChild(parentDiv);
});

test('Element.outerHTML setter', function () {
    var parentDiv = document.createElement('div');
    var childDiv  = parentDiv.appendChild(document.createElement('div'));

    document.body.appendChild(parentDiv);

    childDiv.outerHTML = '<form action="some-path.html" target="_parent"></form>';

    var processedForm = parentDiv.firstChild;

    ok(!hasIframeFlag(nativeMethods.getAttribute.call(processedForm, 'action')));

    parentDiv.parentNode.removeChild(parentDiv);
});

test('Range.createContextualFragment', function () {
    var range     = document.createRange();
    var container = document.createElement('div');

    document.body.appendChild(container);

    range.selectNode(container);

    var fragment      = range.createContextualFragment('<form action="some-path.html" target="_parent"></form>');
    var processedForm = fragment.querySelector('form');

    ok(!hasIframeFlag(nativeMethods.getAttribute.call(processedForm, 'action')));

    container.parentNode.removeChild(container);
});


module('regression');

test('setAttribute: frame src (GH-1070)', function () {
    var frame    = document.createElement('frame');
    var proxyUrl = 'http://' + location.hostname + ':' + settings.get().crossDomainProxyPort +
                   '/sessionId!i!s*example.com/https://example.com/';

    frame.setAttribute('src', 'https://example.com/');

    strictEqual(nativeMethods.getAttribute.call(frame, 'src'), proxyUrl);
});
