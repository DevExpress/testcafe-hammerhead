var INTERNAL_PROPS    = hammerhead.get('../processing/dom/internal-properties');
var urlUtils          = hammerhead.get('./utils/url');
var DomProcessor      = hammerhead.get('../processing/dom');
var processScript     = hammerhead.get('../processing/script').processScript;
var styleProcessor    = hammerhead.get('../processing/style');
var isScriptProcessed = hammerhead.get('../processing/script').isScriptProcessed;

var Promise               = hammerhead.Promise;
var nativeMethods         = hammerhead.nativeMethods;
var browserUtils          = hammerhead.utils.browser;
var elementEditingWatcher = hammerhead.sandbox.event.elementEditingWatcher;
var eventSimulator        = hammerhead.sandbox.event.eventSimulator;

test('unsupported protocol', function () {
    var img = document.createElement('img');

    img.src = 'about:blank';

    strictEqual(img.src, 'about:blank');
    strictEqual(nativeMethods.imageSrcGetter.call(img), 'about:blank');
});

test('anchor', function () {
    var anchor                               = document.createElement('a');
    var emptyAnchor                          = document.createElement('a');
    var anchorWithNotSupportedProtocol       = document.createElement('a');
    var etalonAnchor                         = document.createElement('a');
    var etalonEmptyAnchor                    = document.createElement('a');
    var etalonAnchorWithNotSupportedProtocol = document.createElement('a');
    var url                                  = 'https://google.com:1888/index.html?value#yo';
    var proxyUrl                             = urlUtils.getProxyUrl(url);

    nativeMethods.anchorHrefSetter.call(etalonAnchor, url);
    nativeMethods.anchorHrefSetter.call(anchor, proxyUrl);

    strictEqual(anchor.port, nativeMethods.anchorPortGetter.call(etalonAnchor), 'Anchor - port');
    strictEqual(anchor.host, nativeMethods.anchorHostGetter.call(etalonAnchor), 'Anchor - host');
    strictEqual(anchor.hostname, nativeMethods.anchorHostnameGetter.call(etalonAnchor), 'Anchor - hostname');
    strictEqual(anchor.protocol, nativeMethods.anchorProtocolGetter.call(etalonAnchor), 'Anchor - protocol');
    strictEqual(anchor.pathname, nativeMethods.anchorPathnameGetter.call(etalonAnchor), 'Anchor - pathname');
    strictEqual(anchor.search, nativeMethods.anchorSearchGetter.call(etalonAnchor), 'Anchor - search');
    strictEqual(anchor.hash, etalonAnchor.hash, 'Anchor - hash');

    if (nativeMethods.anchorOriginGetter)
        strictEqual(anchor.origin, nativeMethods.anchorOriginGetter.call(etalonAnchor));

    strictEqual(emptyAnchor.port, nativeMethods.anchorPortGetter.call(etalonEmptyAnchor));
    strictEqual(emptyAnchor.host, nativeMethods.anchorHostGetter.call(etalonEmptyAnchor));
    strictEqual(emptyAnchor.hostname, nativeMethods.anchorHostnameGetter.call(etalonEmptyAnchor));
    strictEqual(emptyAnchor.protocol, nativeMethods.anchorProtocolGetter.call(etalonEmptyAnchor));
    strictEqual(emptyAnchor.pathname, nativeMethods.anchorPathnameGetter.call(etalonEmptyAnchor));
    strictEqual(emptyAnchor.search, nativeMethods.anchorSearchGetter.call(etalonEmptyAnchor));

    if (nativeMethods.anchorOriginGetter)
        strictEqual(emptyAnchor.origin, nativeMethods.anchorOriginGetter.call(etalonEmptyAnchor));

    // Port
    anchor.port = '8080';
    nativeMethods.anchorPortSetter.call(etalonAnchor, '8080');
    strictEqual(anchor.port, nativeMethods.anchorPortGetter.call(etalonAnchor));

    emptyAnchor.port = '8080';
    nativeMethods.anchorPortSetter.call(etalonEmptyAnchor, '8080');
    strictEqual(emptyAnchor.port, nativeMethods.anchorPortGetter.call(etalonEmptyAnchor));
    nativeMethods.removeAttribute.call(etalonEmptyAnchor, 'href');

    // Host
    anchor.host = 'yandex.com:1234';
    nativeMethods.anchorHostSetter.call(etalonAnchor, 'yandex.com:1234');
    strictEqual(anchor.host, nativeMethods.anchorHostGetter.call(etalonAnchor));

    emptyAnchor.host = 'yandex.com:1234';
    nativeMethods.anchorHostSetter.call(etalonEmptyAnchor, 'yandex.com:1234');
    strictEqual(emptyAnchor.host, nativeMethods.anchorHostGetter.call(etalonEmptyAnchor));
    nativeMethods.removeAttribute.call(etalonEmptyAnchor, 'href');

    // Hostname
    anchor.hostname = 'yandex.ru';
    nativeMethods.anchorHostnameSetter.call(etalonAnchor, 'yandex.ru');
    strictEqual(anchor.hostname, nativeMethods.anchorHostnameGetter.call(etalonAnchor));

    emptyAnchor.hostname = 'yandex.ru';
    nativeMethods.anchorHostnameSetter.call(etalonEmptyAnchor, 'yandex.ru');
    strictEqual(emptyAnchor.hostname, nativeMethods.anchorHostnameGetter.call(etalonEmptyAnchor));
    nativeMethods.removeAttribute.call(etalonEmptyAnchor, 'href');

    // Protocol
    anchor.protocol = 'http:';
    nativeMethods.anchorProtocolSetter.call(etalonAnchor, 'http:');
    strictEqual(anchor.protocol, nativeMethods.anchorProtocolGetter.call(etalonAnchor));
    nativeMethods.removeAttribute.call(etalonEmptyAnchor, 'href');

    if (!browserUtils.isSafari) {
        emptyAnchor.protocol = 'https:';
        nativeMethods.anchorProtocolSetter.call(etalonEmptyAnchor, 'https:');
        strictEqual(emptyAnchor.protocol, nativeMethods.anchorProtocolGetter.call(etalonEmptyAnchor));
        nativeMethods.removeAttribute.call(etalonEmptyAnchor, 'href');
    }

    // Pathname
    var newPathName = nativeMethods.anchorPathnameGetter.call(etalonAnchor) + '/index.php';

    anchor.pathname = newPathName;
    nativeMethods.anchorPathnameSetter.call(etalonAnchor, newPathName);
    strictEqual(anchor.pathname, nativeMethods.anchorPathnameGetter.call(etalonAnchor));

    emptyAnchor.pathname = 'temp/index.php'; // TODO: iOS!!!
    nativeMethods.anchorPathnameSetter.call(etalonEmptyAnchor, 'temp/index.php');
    strictEqual(emptyAnchor.pathname, nativeMethods.anchorPathnameGetter.call(etalonEmptyAnchor));
    nativeMethods.removeAttribute.call(etalonEmptyAnchor, 'href');

    // Search
    anchor.search = '?test=temp';
    nativeMethods.anchorSearchSetter.call(etalonAnchor, '?test=temp');
    strictEqual(anchor.search, nativeMethods.anchorSearchGetter.call(etalonAnchor));

    emptyAnchor.search = '?test=temp';
    nativeMethods.anchorSearchSetter.call(etalonEmptyAnchor, '?test=temp');
    strictEqual(emptyAnchor.search, nativeMethods.anchorSearchGetter.call(etalonEmptyAnchor));
    nativeMethods.removeAttribute.call(etalonEmptyAnchor, 'href');


    nativeMethods.anchorHrefSetter.call(anchorWithNotSupportedProtocol, 'javascript:;');
    nativeMethods.anchorHrefSetter.call(etalonAnchorWithNotSupportedProtocol, 'javascript:;');

    strictEqual(anchorWithNotSupportedProtocol.port, nativeMethods.anchorPortGetter.call(etalonAnchorWithNotSupportedProtocol));
    strictEqual(anchorWithNotSupportedProtocol.host, nativeMethods.anchorHostGetter.call(etalonAnchorWithNotSupportedProtocol));
    strictEqual(anchorWithNotSupportedProtocol.hostname, nativeMethods.anchorHostnameGetter.call(etalonAnchorWithNotSupportedProtocol));
    strictEqual(anchorWithNotSupportedProtocol.protocol, nativeMethods.anchorProtocolGetter.call(etalonAnchorWithNotSupportedProtocol));
    strictEqual(anchorWithNotSupportedProtocol.pathname, nativeMethods.anchorPathnameGetter.call(etalonAnchorWithNotSupportedProtocol));
    strictEqual(anchorWithNotSupportedProtocol.search, nativeMethods.anchorSearchGetter.call(etalonAnchorWithNotSupportedProtocol));

    if (nativeMethods.anchorOriginGetter)
        strictEqual(anchorWithNotSupportedProtocol.origin, nativeMethods.anchorOriginGetter.call(etalonAnchorWithNotSupportedProtocol));
});

test('image (GH-1502)', function () {
    var imageNS  = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    // var image    = document.createElement('image');
    var url      = 'https://google.com:1888/index.html?value#yo';
    var proxyUrl = urlUtils.getProxyUrl(url);

    nativeMethods.baseValSetter.call(imageNS.href, proxyUrl); // should returns value ??

    strictEqual(nativeMethods.animValGetter.call(imageNS.href), proxyUrl);
    strictEqual(nativeMethods.baseValGetter.call(imageNS.href), proxyUrl);

    // strictEqual(nativeMethods.imageHrefAnimValGetter.call(nativeMethods.imageHrefGetter.call(imageNS)), proxyUrl);
    // strictEqual(nativeMethods.imageHrefBaseValGetter.call(nativeMethods.imageHrefGetter.call(imageNS)), proxyUrl);
});

test('location as a local var', function () {
    var location = '';

    eval(processScript('location = "test"'));
    strictEqual(location, 'test');

    eval(processScript('location = null'));
    strictEqual(location, null);

    eval(processScript('location = undefined'));
    strictEqual(location, void 0);

    eval(processScript('location = ""'));
    strictEqual(location, '');
});

test('simple type', function () {
    strictEqual(setProperty(1, 'prop_name', 2), 2);
});

test('script text', function () {
    var script = document.createElement('script');

    eval(processScript('script.text="var test = window.href;"'));
    ok(isScriptProcessed(script.text));
});

test('iframe', function () {
    var iframe     = document.createElement('iframe');
    var storedAttr = DomProcessor.getStoredAttrName('sandbox');

    eval(processScript('iframe.sandbox="allow-scripts"'));
    strictEqual(nativeMethods.getAttribute.call(iframe, 'sandbox'), 'allow-scripts allow-same-origin');
    strictEqual(nativeMethods.getAttribute.call(iframe, storedAttr), 'allow-scripts');

    eval(processScript('iframe.sandbox="allow-same-origin"'));
    strictEqual(nativeMethods.getAttribute.call(iframe, 'sandbox'), 'allow-same-origin allow-scripts');
    strictEqual(nativeMethods.getAttribute.call(iframe, storedAttr), 'allow-same-origin');

    eval(processScript('iframe.sandbox="allow-scripts allow-same-origin"'));
    strictEqual(nativeMethods.getAttribute.call(iframe, 'sandbox'), 'allow-scripts allow-same-origin');
    strictEqual(nativeMethods.getAttribute.call(iframe, storedAttr), 'allow-scripts allow-same-origin');

    eval(processScript('iframe.sandbox="allow-same-origin allow-forms"'));
    strictEqual(nativeMethods.getAttribute.call(iframe, 'sandbox'), 'allow-same-origin allow-forms allow-scripts');
    strictEqual(nativeMethods.getAttribute.call(iframe, storedAttr), 'allow-same-origin allow-forms');

    eval(processScript('iframe.sandbox="allow-scripts allow-forms"'));
    strictEqual(nativeMethods.getAttribute.call(iframe, 'sandbox'), 'allow-scripts allow-forms allow-same-origin');
    strictEqual(nativeMethods.getAttribute.call(iframe, storedAttr), 'allow-scripts allow-forms');

    eval(processScript('iframe.sandbox="allow-scripts allow-forms allow-same-origin"'));
    strictEqual(nativeMethods.getAttribute.call(iframe, 'sandbox'), 'allow-scripts allow-forms allow-same-origin');
    strictEqual(nativeMethods.getAttribute.call(iframe, storedAttr), 'allow-scripts allow-forms allow-same-origin');

    eval(processScript('iframe.sandbox="allow-forms"'));
    strictEqual(nativeMethods.getAttribute.call(iframe, 'sandbox'), 'allow-forms allow-same-origin allow-scripts');
    strictEqual(nativeMethods.getAttribute.call(iframe, DomProcessor.getStoredAttrName('sandbox')), 'allow-forms');

    var result = '';

    eval(processScript('result = iframe.sandbox'));
    strictEqual(result, 'allow-forms');
});

test('innerHTML', function () {
    var div       = document.createElement('div');
    var scriptUrl = 'http://some.com/script.js';
    var linkUrl   = 'http://some.com/page';

    document[INTERNAL_PROPS.documentCharset] = 'utf-8';

    eval(processScript('div.innerHTML = "<script src=\\"" + scriptUrl + "\\"><' + '/script><a href=\\"" + linkUrl + "\\"></a>";'));

    strictEqual(div.children.length, 2);
    strictEqual(nativeMethods.scriptSrcGetter.call(div.children[0]), urlUtils.getProxyUrl(scriptUrl, { resourceType: 's', charset: 'utf-8' }));
    strictEqual(nativeMethods.anchorHrefGetter.call(div.children[1]), urlUtils.getProxyUrl(linkUrl));

    document[INTERNAL_PROPS.documentCharset] = null;
});

test('innerHTML, innerText, text, textContent', function () {
    var script              = document.createElement('script');
    var style               = document.createElement('style');
    var scriptText          = 'var test = window.href';
    var styleText           = 'div {background:url(http://some.domain.com/image.png)}';
    var processedScriptText = processScript(scriptText, true).replace(/\s/g, '');
    var processedStyleText  = styleProcessor.process(styleText, urlUtils.getProxyUrl, true).replace(/\s/g, '');
    var testProperties      = ['innerHTML', 'innerText', 'text', 'textContent'];

    testProperties.forEach(function (property) {
        var returnedValue = setProperty(script, property, scriptText);

        strictEqual(returnedValue, scriptText);
        strictEqual(script[property].replace(/\s/g, ''), processedScriptText);

        returnedValue = setProperty(script, property, '');

        strictEqual(returnedValue, '');
        strictEqual(script[property], '');
    });

    testProperties.forEach(function (property) {
        var returnedValue = setProperty(style, property, styleText);

        strictEqual(returnedValue, styleText);

        // NOTE: text property is not supported for style element
        if (property === 'text')
            strictEqual(style[property], styleText);
        else
            strictEqual(style[property].replace(/\s/g, ''), processedStyleText);

        returnedValue = setProperty(style, property, '');

        strictEqual(returnedValue, '');
        strictEqual(style[property], '');
    });

    testProperties.forEach(function (property) {
        var obj           = { a: 1 };
        var returnedValue = setProperty(script, property, obj);

        strictEqual(returnedValue, obj);
        strictEqual(script[property], '[object Object]');
    });

    testProperties.forEach(function (property) {
        var returnedValue = setProperty(script, property, null);
        var propertyValue = script[property];

        script[property] = null;

        strictEqual(returnedValue, null);
        strictEqual(propertyValue, script[property]);
    });

    testProperties.forEach(function (property) {
        var returnedValue = setProperty(script, property, void 0);
        var propertyValue = script[property];

        script[property] = void 0;

        strictEqual(returnedValue, void 0);
        strictEqual(propertyValue, script[property]);
    });

});

test('body.innerHTML in iframe', function () {
    return createTestIframe({ src: getSameDomainPageUrl('../../../data/code-instrumentation/iframe.html') })
        .then(function (iframe) {
            var hasShadowUIRoot = function () {
                var iframeBody               = iframe.contentDocument.body;
                var bodyChildrenOriginLength = nativeMethods.htmlCollectionLengthGetter.call(iframeBody.children);
                var root                     = iframeBody.children[bodyChildrenOriginLength - 1];

                return root && root.id.indexOf('root-') === 0;
            };

            ok(hasShadowUIRoot());

            eval(processScript('iframe.contentDocument.body.innerHTML = "";'));

            return window.QUnitGlobals.wait(hasShadowUIRoot);
        });
});

// NOTE: IE does not allow overriding the postMessage method.
if (!browserUtils.isIE) {
    asyncTest('postMessage', function () {
        var target = window.location.protocol + '//' + window.location.host;

        createTestIframe({ src: window.location.origin })
            .then(function (iframe) {
                iframe.contentWindow.postMessage = function () {
                    strictEqual(target, window.location.origin);
                    start();
                };
                eval(processScript('iframe.contentWindow.postMessage("data", "' + target + '")'));
            });
    });
}

test('outerHTML', function () {
    var parentDiv = document.createElement('div');
    var childDiv  = document.createElement('div');
    var htmlText  = '<a href="http://domain.com/">link</a><script src="http://domain.com/script"><' + '/script>';
    var obj       = { b: 1 };

    parentDiv.appendChild(childDiv);

    strictEqual(parentDiv.children.length, 1);
    strictEqual(parentDiv.firstChild, childDiv);

    setProperty(childDiv, 'outerHTML', htmlText);

    strictEqual(parentDiv.children.length, 2);
    strictEqual(nativeMethods.anchorHrefGetter.call(parentDiv.firstChild), urlUtils.getProxyUrl('http://domain.com/'));
    strictEqual(nativeMethods.scriptSrcGetter.call(parentDiv.lastChild), urlUtils.getProxyUrl('http://domain.com/script', { resourceType: 's' }));

    parentDiv.innerHTML = '';
    parentDiv.appendChild(childDiv);

    var returnedValue = setProperty(childDiv, 'outerHTML', obj);

    strictEqual(returnedValue, obj);
    strictEqual(parentDiv.innerHTML, '[object Object]');

    parentDiv.innerHTML = '';
    parentDiv.appendChild(childDiv);

    returnedValue = setProperty(childDiv, 'outerHTML', null);

    var propertyValue = parentDiv.innerHTML;

    parentDiv.innerHTML = '';
    parentDiv.appendChild(childDiv);

    childDiv.outerHTML = null;

    strictEqual(returnedValue, null);
    strictEqual(propertyValue, parentDiv.innerHTML);

    parentDiv.innerHTML = '';
    parentDiv.appendChild(childDiv);

    returnedValue = setProperty(childDiv, 'outerHTML', void 0);
    propertyValue = parentDiv.innerHTML;

    parentDiv.innerHTML = '';
    parentDiv.appendChild(childDiv);

    childDiv.outerHTML = void 0;

    strictEqual(returnedValue, void 0);
    strictEqual(propertyValue, parentDiv.innerHTML);
});

module('regression');

test('innerHTML in iframe (GH-620)', function () {
    var url      = 'somePage.html';
    var proxyUrl = urlUtils.getProxyUrl(url, { resourceType: 'i' });

    return createTestIframe()
        .then(function (iframe) {
            eval(processScript('iframe.contentDocument.body.innerHTML = "<a href=\\"' + url + '\\">link</a>";'));

            strictEqual(nativeMethods.anchorHrefGetter.call(iframe.contentDocument.body.firstChild), proxyUrl);
        });
});

test('script block inserted via element.innerHtml must not be executed (B237015)', function () {
    var testPropertyName = 'testProperty';
    var el               = document.createElement('div');
    var body             = document.getElementsByTagName('body')[0];
    var script           = '<script>window.' + testPropertyName + ' = true;<' + '/script>';

    body.appendChild(el);
    el.innerHTML = script;

    ok(!window[testPropertyName]);
});

if (!browserUtils.isIE) {
    asyncTest('valid resource type for iframe.contentWindow.location must be calculated', function () {
        var iframe  = document.createElement('iframe');
        var handler = function () {
            iframe.removeEventListener('load', handler);
            iframe.addEventListener('load', function () {
                strictEqual(urlUtils.parseProxyUrl(iframe.contentWindow.location).resourceType, 'i');
                iframe.parentNode.removeChild(iframe);
                start();
            });

            eval(processScript('iframe.contentWindow.location = "/test.html";'));
        };

        iframe.id = 'testT260697';
        iframe.addEventListener('load', handler);
        document.body.appendChild(iframe);
    });
}

test('iframe.body.innerHtml must be overriden (Q527555)', function () {
    return createTestIframe()
        .then(function (iframe) {
            var iframeBody = iframe.contentWindow.document.body;
            var html       = '<a href="url" ' + DomProcessor.getStoredAttrName('src') + '="url1" />';

            iframeBody.innerHTML = html;

            ok(getProperty(iframeBody, 'innerHTML') !== html);
        });
});

test('setting the link.href attribute to "mailto" in iframe (T228218)', function () {
    var storedGetProxyUrl = urlUtils.getProxyUrl;
    var anchror           = document.createElement('a');

    urlUtils.getProxyUrl = function () {
        return 'http://replaced';
    };

    anchror.href = 'http://host.com/';

    ok(nativeMethods.anchorHrefGetter.call(anchror).indexOf('http://replaced') === 0);

    anchror.href = 'mailto:test@mail.com';

    strictEqual(nativeMethods.anchorHrefGetter.call(anchror), 'mailto:test@mail.com');
    strictEqual(anchror.href, 'mailto:test@mail.com');
    strictEqual(anchror.getAttribute('href'), 'mailto:test@mail.com');

    urlUtils.getProxyUrl = storedGetProxyUrl;
});

test('link without the href attrubute must return an empty value for href (B238838)', function () {
    var url             = 'http://www.test.com/';
    var linkWithHref    = document.createElement('a');
    var linkWithoutHref = document.createElement('a');

    linkWithHref.href = url;

    strictEqual(linkWithHref.href, url);
    strictEqual(linkWithoutHref.href, '');
});

test('event.which must return undefined if originalEvent is null (T232468)', function () {
    /* eslint-disable no-unused-vars */
    var evtObj = {
        originalEvent: null
    };

    strictEqual(eval(processScript('evtObj.which')), void 0);
    /* eslint-enable no-unused-vars */
});

test('input\'s onchange event must not be raise after press Tab key (T221375)', function () {
    var $input     = $('<input value="0">');
    var firedCount = 0;

    $input.on('change', function () {
        firedCount++;
    });

    expect(1);

    function nextTick () {
        return new Promise(function (resolve) {
            setTimeout(resolve, 0);
        });
    }

    elementEditingWatcher.watchElementEditing($input[0]);

    nativeMethods.inputValueSetter.call($input[0], '123');
    eventSimulator.blur($input[0]);

    return nextTick()
        .then(function () {
            elementEditingWatcher.watchElementEditing($input[0]);

            nativeMethods.inputValueSetter.call($input[0], '423');

            $input[0].value = 42;

            eventSimulator.blur($input[0]);
        })
        .then(nextTick)
        .then(function () {
            strictEqual(firedCount, 1);
            $input.remove();
        });
});

test('restoring the removed RegExp.prototype.test function should not throw an error (GH-331)', function () {
    var savedTest = RegExp.prototype.test;
    var withError = false;

    try {
        delete RegExp.prototype.test;
        setProperty(RegExp.prototype, 'test', savedTest);
    }
    catch (e) {
        withError = true;
        /* eslint-disable no-extend-native */
        RegExp.prototype.test = savedTest;
        /* eslint-enable no-extend-native */
    }

    ok(!withError);
});

test('the client code gets access to the Hammerhead script (GH-479)', function () {
    var div = document.createElement('div');

    eval(processScript('div.innerHTML="<html><body><div id=\\"test\\"></div></body></html>"'));

    strictEqual(div.childNodes.length, 1);
    strictEqual(div.childNodes[0].id, 'test');
});

test("location assignment doesn't work (GH-640)", function () {
    var iframeSrc    = getSameDomainPageUrl('../../../data/code-instrumentation/iframe.html');
    var iframeNewSrc = getSameDomainPageUrl('../../../data/active-window-tracker/active-window-tracker.html');

    return createTestIframe({ src: iframeSrc })
        .then(function (iframe) {
            return new Promise(function (resolve) {
                iframe.addEventListener('load', function () {
                    resolve(iframe);
                });

                var changeLocationScript = 'location = "' + iframeNewSrc + '";';

                iframe.contentWindow.eval.call(iframe.contentWindow, processScript(changeLocationScript));
            });
        })
        .then(function (iframe) {
            var parsedProxyUrl = urlUtils.parseProxyUrl(iframe.contentWindow.location);

            strictEqual(parsedProxyUrl.resourceType, 'i');
            strictEqual(parsedProxyUrl.destResourceInfo.partAfterHost, urlUtils.parseUrl(iframeNewSrc).partAfterHost);
        });
});

test('setter returns a correct value (GH-907)', function () {
    var checkReturnedValue = function (tagName, prop, value) {
        strictEqual(setProperty(document.createElement(tagName), prop, value), value);
    };

    checkReturnedValue('form', 'action', './path');
    checkReturnedValue('input', 'autocomplete', 'on');
    checkReturnedValue('object', 'data', './path');
    checkReturnedValue('a', 'href', './path');
    checkReturnedValue('html', 'manifest', './path');
    checkReturnedValue('iframe', 'sandbox', 'allow-scripts');
    checkReturnedValue('img', 'src', './path');
    checkReturnedValue('a', 'target', '_blank');
});

test('should not throw an error on setting the body.innerHtml when document.body equals null (GH-1172)', function () {
    var iframe = document.createElement('iframe');

    iframe.id = 'test' + Date.now();

    document.body.appendChild(iframe);

    iframe.contentDocument.write(
        '<head>',
        '    <script>',
        '        var body = document.implementation.createHTMLDocument("").body;',
        '        try {',
        '            body.innerHTML = "<form></form>";',
        '            window.hasError = false;',
        '        } catch (e) {',
        '            window.hasError = true;',
        '        }',
        '    <' + '/script>',
        '</head>'
    );

    ok(!iframe.contentWindow.hasError);

    document.body.removeChild(iframe);
});

if (!browserUtils.isFirefox) {
    test('set search property to anchor with unsupported protocol (GH-1276)', function () {
        var anchor = document.createElement('a');

        anchor.setAttribute('href', 'unsupported://some.link.com/path?x=10&y=20');

        anchor.search = '?z=30';

        strictEqual(nativeMethods.anchorHrefGetter.call(anchor), 'unsupported://some.link.com/path?z=30');
    });
}

test('should properly set value of instrumented property if it is readonly for DOM elements (GH-1351)', function () {
    var input = document.createElement('input');

    var testCases = [
        {
            prop:   'attributes',
            value1: input.attributes,
            value2: null
        },
        {
            prop:   'nextSibling',
            value1: input,
            value2: null
        },
        {
            prop:   'nextElementSibling',
            value1: input,
            value2: null
        }
    ];

    var obj = {};

    testCases.forEach(function (testCase) {
        setProperty(obj, testCase.prop, testCase.value1);
        strictEqual(getProperty(obj, testCase.prop), testCase.value1);

        setProperty(obj, testCase.prop, testCase.value2);
        strictEqual(getProperty(obj, testCase.prop), testCase.value2);

        delete obj[testCase.prop];
    });
});

