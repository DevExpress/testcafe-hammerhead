var INTERNAL_PROPS    = hammerhead.get('../processing/dom/internal-properties');
var urlUtils          = hammerhead.get('./utils/url');
var domProcessor      = hammerhead.get('./dom-processor');
var processScript     = hammerhead.get('../processing/script').processScript;
var styleProcessor    = hammerhead.get('../processing/style');
var isScriptProcessed = hammerhead.get('../processing/script').isScriptProcessed;

var Promise               = hammerhead.Promise;
var nativeMethods         = hammerhead.nativeMethods;
var browserUtils          = hammerhead.utils.browser;
var iframeSandbox         = hammerhead.sandbox.iframe;
var elementEditingWatcher = hammerhead.sandbox.event.elementEditingWatcher;
var eventSimulator        = hammerhead.sandbox.event.eventSimulator;

QUnit.testStart(function () {
    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT_EVENT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, initIframeTestHandler);
});

test('unsupported protocol', function () {
    var img = document.createElement('img');

    eval(processScript('img.src = "about:blank";'));
    strictEqual(getProperty(img, 'src'), 'about:blank');
    strictEqual(img.src, 'about:blank');
});

test('anchor', function () {
    var anchor = document.createElement('a');
    /* eslint-disable no-unused-vars */
    var emptyAnchor = document.createElement('a');
    /* eslint-enable no-unused-vars */
    var anchorWithNotSupportedProtocol       = document.createElement('a');
    var etalonAnchor                         = document.createElement('a');
    var etalonEmptyAnchor                    = document.createElement('a');
    var etalonAnchorWithNotSupportedProtocol = document.createElement('a');
    var url                                  = 'https://google.com:1888/index.html?value#yo';
    var proxyUrl                             = urlUtils.getProxyUrl(url);

    etalonAnchor.href = url;
    anchor.href       = proxyUrl;

    var execScript = function (script) {
        return eval(processScript(script));
    };

    strictEqual(execScript('anchor.port'), etalonAnchor.port, 'Anchor - port');
    strictEqual(execScript('anchor.host'), etalonAnchor.host, 'Anchor - host');
    strictEqual(execScript('anchor.hostname'), etalonAnchor.hostname, 'Anchor - hostname');
    strictEqual(execScript('anchor.protocol'), etalonAnchor.protocol, 'Anchor - protocol');
    strictEqual(execScript('anchor.pathname'), etalonAnchor.pathname, 'Anchor - pathname');
    strictEqual(execScript('anchor.search'), etalonAnchor.search, 'Anchor - search');
    strictEqual(execScript('anchor.hash'), etalonAnchor.hash, 'Anchor - hash');


    if ('origin' in anchor)
        strictEqual(execScript('anchor.origin'), etalonAnchor.origin);

    strictEqual(execScript('emptyAnchor.port'), etalonEmptyAnchor.port);
    strictEqual(execScript('emptyAnchor.host'), etalonEmptyAnchor.host);
    strictEqual(execScript('emptyAnchor.hostname'), etalonEmptyAnchor.hostname);
    strictEqual(execScript('emptyAnchor.protocol'), etalonEmptyAnchor.protocol);
    strictEqual(execScript('emptyAnchor.pathname'), etalonEmptyAnchor.pathname);
    strictEqual(execScript('emptyAnchor.search'), etalonEmptyAnchor.search);

    if ('origin' in etalonEmptyAnchor)
        strictEqual(execScript('emptyAnchor.origin'), etalonEmptyAnchor.origin);

    // Port
    execScript('anchor.port="8080";');
    etalonAnchor.port = '8080';
    strictEqual(execScript('anchor.port'), etalonAnchor.port);

    etalonEmptyAnchor.port = '8080';
    execScript('emptyAnchor.port="8080";');
    strictEqual(execScript('emptyAnchor.port'), etalonEmptyAnchor.port);

    // Host
    execScript('anchor.host="yandex.com";');
    etalonAnchor.host = 'yandex.com';
    strictEqual(execScript('anchor.host'), etalonAnchor.host);

    execScript('emptyAnchor.host="yandex.com";');
    etalonEmptyAnchor.host = 'yandex.com';
    strictEqual(execScript('emptyAnchor.host'), etalonEmptyAnchor.host);

    // Hostname
    execScript('anchor.hostname="yandex.ru";');
    etalonAnchor.hostname = 'yandex.ru';
    strictEqual(execScript('anchor.hostname'), etalonAnchor.hostname);

    execScript('emptyAnchor.hostname="yandex.ru";');
    etalonEmptyAnchor.hostname = 'yandex.ru';
    strictEqual(execScript('emptyAnchor.hostname'), etalonEmptyAnchor.hostname);

    // Protocol
    execScript('anchor.protocol="http:";');
    etalonAnchor.protocol = 'http:';
    strictEqual(execScript('anchor.protocol'), etalonAnchor.protocol);


    if (!browserUtils.isSafari) {
        execScript('emptyAnchor.protocol="https:";');
        etalonEmptyAnchor.protocol = 'https:';
        strictEqual(execScript('emptyAnchor.protocol'), etalonEmptyAnchor.protocol);
    }

    // Pathname
    var newPathName = etalonAnchor.pathname + '/index.php';

    execScript('anchor.pathname="' + newPathName + '"');
    etalonAnchor.pathname = newPathName;
    strictEqual(execScript('anchor.pathname'), etalonAnchor.pathname);

    execScript('emptyAnchor.pathname="temp/index.php";'); // TODO: iOS!!!
    etalonEmptyAnchor.pathname = 'temp/index.php';
    strictEqual(execScript('emptyAnchor.pathname'), etalonEmptyAnchor.pathname);

    // Origin
    // NOTE: IE has no origin property.
    if ('origin' in etalonEmptyAnchor) {
        execScript('anchor.origin="http://yandex.ru:2000"');
        etalonAnchor.origin = 'http://yandex.ru:2000';
        strictEqual(execScript('anchor.origin'), etalonAnchor.origin);

        execScript('emptyAnchor.origin="http://yandex.ru:2000";');
        etalonEmptyAnchor.origin = 'http://yandex.ru:2000';
        strictEqual(execScript('emptyAnchor.origin'), etalonEmptyAnchor.origin);
    }

    // Search
    execScript('anchor.search="?test=temp"');
    etalonAnchor.search = '?test=temp';
    strictEqual(execScript('anchor.search'), etalonAnchor.search);

    execScript('emptyAnchor.search="?test=temp"');
    etalonEmptyAnchor.search = '?test=temp';
    strictEqual(execScript('emptyAnchor.search'), etalonEmptyAnchor.search);

    anchorWithNotSupportedProtocol.href       = 'javascript:;';
    etalonAnchorWithNotSupportedProtocol.href = 'javascript:;';

    strictEqual(execScript('anchorWithNotSupportedProtocol.port'), etalonAnchorWithNotSupportedProtocol.port);
    strictEqual(execScript('anchorWithNotSupportedProtocol.host'), etalonAnchorWithNotSupportedProtocol.host);
    strictEqual(execScript('anchorWithNotSupportedProtocol.hostname'), etalonAnchorWithNotSupportedProtocol.hostname);
    strictEqual(execScript('anchorWithNotSupportedProtocol.protocol'), etalonAnchorWithNotSupportedProtocol.protocol);
    strictEqual(execScript('anchorWithNotSupportedProtocol.pathname'), etalonAnchorWithNotSupportedProtocol.pathname);
    strictEqual(execScript('anchorWithNotSupportedProtocol.search'), etalonAnchorWithNotSupportedProtocol.search);

    if ('origin' in anchorWithNotSupportedProtocol)
        strictEqual(execScript('anchorWithNotSupportedProtocol.origin'), etalonAnchorWithNotSupportedProtocol.origin);
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
    var storedAttr = domProcessor.getStoredAttrName('sandbox');

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
    strictEqual(nativeMethods.getAttribute.call(iframe, domProcessor.getStoredAttrName('sandbox')), 'allow-forms');

    var result = '';

    eval(processScript('result = iframe.sandbox'));
    strictEqual(result, 'allow-forms');
});

test('innerHTML', function () {
    var div       = document.createElement('div');
    var scriptUrl = 'http://some.com/script.js';
    var linkUrl   = 'http://some.com/page';

    document[INTERNAL_PROPS.documentCharset] = 'utf-8';

    eval(processScript('div.innerHTML = "<script src=\\"" + scriptUrl + "\\"><\/script><a href=\\"" + linkUrl + "\\"></a>";'));

    strictEqual(div.children.length, 2);
    strictEqual(div.children[0].src, urlUtils.getProxyUrl(scriptUrl, { resourceType: 's', charset: 'utf-8' }));
    strictEqual(div.children[1].href, urlUtils.getProxyUrl(linkUrl));

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
    var iframe = document.createElement('iframe');
    var src    = window.QUnitGlobals.getResourceUrl('../../../data/code-instrumentation/iframe.html');

    iframe.setAttribute('src', src);

    var promise = window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            var hasShadowUIRoot = function () {
                var iframeBody = iframe.contentDocument.body;
                var root       = iframeBody.children[iframeBody.children.length - 1];

                return root && root.id.indexOf('root-') === 0;
            };

            ok(hasShadowUIRoot());

            eval(processScript('iframe.contentDocument.body.innerHTML = "";'));

            return window.QUnitGlobals.wait(hasShadowUIRoot);
        })
        .then(function () {
            iframe.parentNode.removeChild(iframe);
        });

    document.body.appendChild(iframe);

    return promise;
});

// NOTE: IE does not allow overriding the postMessage method.
if (!browserUtils.isIE) {
    asyncTest('postMessage', function () {
        var target = window.location.protocol + '//' + window.location.host;
        var iframe = document.createElement('iframe');

        iframe.src = window.location.origin;
        window.QUnitGlobals.waitForIframe(iframe)
            .then(function () {
                iframe.contentWindow.postMessage = function () {
                    strictEqual(target, window.location.origin);
                    iframe.parentNode.removeChild(iframe);
                    start();
                };
                eval(processScript('iframe.contentWindow.postMessage("data", "' + target + '")'));
            });
        document.body.appendChild(iframe);
    });
}

test('outerHTML', function () {
    var parentDiv = document.createElement('div');
    var childDiv  = document.createElement('div');
    var htmlText  = '<a href="http://domain.com/">link</a><script src="http://domain.com/script"><\/script>';
    var obj       = { b: 1 };

    parentDiv.appendChild(childDiv);

    strictEqual(parentDiv.children.length, 1);
    strictEqual(parentDiv.firstChild, childDiv);

    setProperty(childDiv, 'outerHTML', htmlText);

    strictEqual(parentDiv.children.length, 2);
    strictEqual(parentDiv.firstChild.href, urlUtils.getProxyUrl('http://domain.com/'));
    strictEqual(parentDiv.lastChild.src, urlUtils.getProxyUrl('http://domain.com/script', { resourceType: 's' }));

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
    var iframe   = document.createElement('iframe');
    var url      = 'somePage.html';
    var proxyUrl = urlUtils.getProxyUrl(url, { resourceType: 'i' });

    iframe.id = 'test' + Date.now();

    var promise = window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            eval(processScript('iframe.contentDocument.body.innerHTML = "<a href=\\"' + url + '\\">link</a>";'));

            strictEqual(iframe.contentDocument.body.firstChild.href, proxyUrl);

            document.body.removeChild(iframe);
        });

    document.body.appendChild(iframe);

    return promise;
});

test('script block inserted via element.innerHtml must not be executed (B237015)', function () {
    var testPropertyName = 'testProperty';
    var el               = document.createElement('div');
    var body             = document.getElementsByTagName('body')[0];
    var script           = '<script>window.' + testPropertyName + ' = true;\<\/script>';

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
    var iframe = document.createElement('iframe');

    iframe.id = 'test' + Date.now();

    var promise = window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            var iframeBody = iframe.contentWindow.document.body;
            var html       = '<a href="url" ' + domProcessor.getStoredAttrName('src') + '="url1" />';

            iframeBody.innerHTML = html;

            ok(getProperty(iframeBody, 'innerHTML') !== html);
            iframe.parentNode.removeChild(iframe);
        });

    document.body.appendChild(iframe);

    return promise;
});

test('setting the link.href attribute to "mailto" in iframe (T228218)', function () {
    var storedGetProxyUrl = urlUtils.getProxyUrl;
    var link              = document.createElement('a');

    urlUtils.getProxyUrl = function () {
        return 'http://replaced';
    };

    eval(processScript('link.href="http://host.com/"'));
    ok(link.href.indexOf('http://replaced') === 0);

    eval(processScript('link.href="mailto:test@mail.com"'));
    strictEqual(link.href, 'mailto:test@mail.com');
    strictEqual(eval(processScript('link.href')), 'mailto:test@mail.com');
    strictEqual(link.getAttribute('href'), 'mailto:test@mail.com');

    urlUtils.getProxyUrl = storedGetProxyUrl;
});

test('link without the href attrubute must return an empty value for href (B238838)', function () {
    var url             = 'http://www.test.com/';
    var linkWithHref    = $('<a href="' + url + '">')[0];
    var linkWithoutHref = $('<a>')[0];

    strictEqual(getProperty(linkWithHref, 'href'), url);
    strictEqual(getProperty(linkWithoutHref, 'href'), '');
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

    $input[0].value = '123';
    eventSimulator.blur($input[0]);

    return nextTick()
        .then(function () {
            elementEditingWatcher.watchElementEditing($input[0]);

            $input[0].value = '423';
            eval(processScript('$input[0].value = 42'));
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
    var iframe       = document.createElement('iframe');
    var iframeSrc    = window.QUnitGlobals.getResourceUrl('../../../data/code-instrumentation/iframe.html');
    var iframeNewSrc = window.QUnitGlobals.getResourceUrl('../../../data/active-window-tracker/active-window-tracker.html');

    iframe.id  = 'test' + Date.now();
    iframe.src = iframeSrc;

    var promise = window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            return new Promise(function (resolve) {
                iframe.addEventListener('load', resolve);
                iframe.contentWindow.eval.call(iframe.contentWindow, processScript('location = "' + iframeNewSrc + '";'));
            });
        })
        .then(function () {
            var parsedProxyUrl = urlUtils.parseProxyUrl(iframe.contentWindow.location);

            strictEqual(parsedProxyUrl.resourceType, 'i');
            strictEqual(parsedProxyUrl.destResourceInfo.partAfterHost, iframeNewSrc);

            iframe.parentNode.removeChild(iframe);
        });

    document.body.appendChild(iframe);

    return promise;
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
        '            body.innerHTML = "<form><\/form>";',
        '            window.hasError = false;',
        '        } catch (e) {',
        '            window.hasError = true;',
        '        }',
        '    <\/script>',
        '</head>'
    );

    ok(!iframe.contentWindow.hasError);

    document.body.removeChild(iframe);
});
