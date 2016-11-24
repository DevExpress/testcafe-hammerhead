var INTERNAL_PROPS         = hammerhead.get('../processing/dom/internal-properties');
var SHADOW_UI_CLASSNAME    = hammerhead.get('../shadow-ui/class-name');
var urlUtils               = hammerhead.get('./utils/url');
var processScript          = hammerhead.get('../processing/script').processScript;
var removeProcessingHeader = hammerhead.get('../processing/script/header').remove;
var destLocation           = hammerhead.get('./utils/destination-location');
var attributesProperty     = hammerhead.get('../client/sandbox/code-instrumentation/properties/attributes');
var processHtml            = hammerhead.get('../client/utils/html').processHtml;

var browserUtils  = hammerhead.utils.browser;
var domUtils      = hammerhead.utils.dom;
var nativeMethods = hammerhead.nativeMethods;
var shadowUI      = hammerhead.sandbox.shadowUI;
var iframeSandbox = hammerhead.sandbox.iframe;

QUnit.testStart(function () {
    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
});

if (!browserUtils.isIE || browserUtils.version > 9) {
    test('autocomplete', function () {
        var input  = $('<input>')[0];
        var etalon = nativeMethods.createElement.call(document, 'input');

        strictEqual(eval(processScript('input.autocomplete')), etalon.autocomplete);
        strictEqual(nativeMethods.getAttribute.call(input, 'autocomplete'), 'off');

        input.setAttribute('autocomplete', 'off');
        nativeMethods.setAttribute.call(etalon, 'autocomplete', 'off');
        strictEqual(eval(processScript('input.autocomplete')), etalon.autocomplete);
        strictEqual(nativeMethods.getAttribute.call(input, 'autocomplete'), 'off');

        input.setAttribute('autocomplete', 'on');
        nativeMethods.setAttribute.call(etalon, 'autocomplete', 'on');
        strictEqual(eval(processScript('input.autocomplete')), etalon.autocomplete);
        strictEqual(nativeMethods.getAttribute.call(input, 'autocomplete'), 'off');

        input.setAttribute('autocomplete', '');
        nativeMethods.setAttribute.call(etalon, 'autocomplete', '');
        strictEqual(eval(processScript('input.autocomplete')), etalon.autocomplete);
        strictEqual(nativeMethods.getAttribute.call(input, 'autocomplete'), 'off');

        input.removeAttribute('autocomplete');
        nativeMethods.removeAttribute.call(etalon, 'autocomplete');
        strictEqual(eval(processScript('input.autocomplete')), etalon.autocomplete);
        strictEqual(nativeMethods.getAttribute.call(input, 'autocomplete'), 'off');
    });
}

test('url', function () {
    /* eslint-disable no-unused-vars */
    var $scriptWithSrc      = $('<script src="http://some.com/script.js">');
    var $scriptWithEmptySrc = $('<script src="">');
    var $scriptWithoutSrc   = $('<script>');
    var $linkWithOnlyHash   = $('<a href="#hash">');

    var proxyLocation = destLocation.get();

    strictEqual(eval(processScript('$scriptWithSrc[0].src')), 'http://some.com/script.js');
    strictEqual(eval(processScript('$scriptWithEmptySrc[0].src')), proxyLocation);
    strictEqual(eval(processScript('$scriptWithoutSrc[0].src')), '');
    strictEqual(eval(processScript('$linkWithOnlyHash[0].href')), proxyLocation + '#hash');
    /* eslint-enable no-unused-vars */
});

test('attributes', function () {
    var link       = document.createElement('a');
    var attributes = null;

    link.setAttribute('href', 'http://some.com/');
    link.setAttribute('rel', 'x');

    eval(processScript('attributes = link.attributes'));
    strictEqual(link.attributes.length, 3);
    strictEqual(attributes.length, 2);
    strictEqual(attributes[0].value, attributes[0].name === 'href' ? 'http://some.com/' : 'x');
    strictEqual(attributes[1].value, attributes[1].name === 'rel' ? 'x' : 'http://some.com/');
    strictEqual(attributes.item(1).value, attributes.item(1).name === 'rel' ? 'x' : 'http://some.com/');
    strictEqual(attributes['href'].value, 'http://some.com/');
    strictEqual(attributes['rel'].value, 'x');
    strictEqual(attributes['ReL'].value, 'x');
    strictEqual(attributes.getNamedItem('rel').value, 'x');

    var div = $('<div attr1="value1" attr2="value2">')[0];

    eval(processScript('attributes = div.attributes'));
    strictEqual(div.attributes, attributes);
});

asyncTest('document properties', function () {
    var $input       = $('<input />').appendTo('body');
    var $shadowInput = $('<input />').appendTo(shadowUI.getRoot());

    expect(3);

    strictEqual(getProperty(document, 'activeElement'), document.body);

    $shadowInput[0].focus();

    setTimeout(function () {
        strictEqual(getProperty(document, 'activeElement'), document.body);

        $input[0].focus();
        setTimeout(function () {
            $shadowInput[0].focus();

            setTimeout(function () {
                strictEqual(getProperty(document, 'activeElement'), $input[0]);

                $input.remove();
                $shadowInput.remove();

                start();
            }, 0);
        }, 0);
    }, 0);
});

test('document.URL', function () {
    var url = eval(processScript('document.URL'));

    strictEqual(url, destLocation.get());
});

test('document.referrer', function () {
    var url          = 'http://some.domain.com/index.html';
    var documentMock = {
        referrer: urlUtils.getProxyUrl(url),
        toString: function () {
            return '[object HTMLDocument]';
        }
    };

    documentMock.toString.toString = function () {
        return domUtils.NATIVE_TO_STRING_TO_STRING;
    };

    strictEqual(getProperty(documentMock, 'referrer'), url);
});

test('document.documentURI', function () {
    var url          = 'http://some.domain.com/index.html';
    var documentMock = {
        referrer:    '',
        documentURI: urlUtils.getProxyUrl(url),
        toString:    function () {
            return '[object HTMLDocument]';
        }
    };

    documentMock.toString.toString = function () {
        return domUtils.NATIVE_TO_STRING_TO_STRING;
    };

    strictEqual(getProperty(documentMock, 'documentURI'), url);
});

test('document.baseURI (GH-920)', function () {
    var url          = 'http://some.domain.com/index.html';
    var documentMock = {
        referrer: '',
        baseURI:  urlUtils.getProxyUrl(url),
        toString: function () {
            return '[object HTMLDocument]';
        }
    };

    documentMock.toString.toString = function () {
        return domUtils.NATIVE_TO_STRING_TO_STRING;
    };

    strictEqual(getProperty(documentMock, 'baseURI'), url);
});

test('CSSStyleSheet.href', function () {
    var storedGetProxyUrl = urlUtils.parseProxyUrl;
    var styleSheet        = document.styleSheets[0];

    urlUtils.parseProxyUrl = function () {
        return { destUrl: 'expected-url' };
    };

    strictEqual(getProperty(styleSheet, 'href'), 'expected-url');
    strictEqual(setProperty(styleSheet, 'href', 'http://some.domain.com/style.css'), 'http://some.domain.com/style.css');

    urlUtils.parseProxyUrl = storedGetProxyUrl;
});

if (browserUtils.isWebKit) {
    test('url in stylesheet properties', function () {
        var el          = document.createElement('div');
        var url         = 'http://some.domain.com/image.png';
        var proxyUrl    = urlUtils.getProxyUrl(url);
        var quote       = (function () {
            var div = document.createElement('div');

            div.style.backgroundImage = 'url(http://example.com/img.jpg)';

            return div.style.backgroundImage.match(/url\((.*)http:\/\/example.com\/img.jpg/)[1];
        })();
        var getExpected = function (value) {
            return 'url(' + quote + value + quote + ')';
        };

        eval(processScript('el.style.backgroundImage="url(' + url + ')"'));
        strictEqual(getProperty(el.style, 'backgroundImage'), getExpected(url), 'backgroundImage');
        strictEqual(el.style.backgroundImage, getExpected(proxyUrl), 'backgroundImage');

        eval(processScript('el.style.background="url(' + url + ')"'));
        strictEqual(getProperty(el.style, 'background'), getExpected(url), 'background');
        strictEqual(el.style.background, getExpected(proxyUrl), 'background');

        eval(processScript('el.style.listStyle="url(' + url + ')"'));
        strictEqual(getProperty(el.style, 'listStyle'), getExpected(url), 'listStyle');
        strictEqual(el.style.listStyle, getExpected(proxyUrl), 'listStyle');

        eval(processScript('el.style.listStyleImage="url(' + url + ')"'));
        strictEqual(getProperty(el.style, 'listStyleImage'), getExpected(url), 'listStyleImage');
        strictEqual(el.style.listStyleImage, getExpected(proxyUrl), 'listStyleImage');

        eval(processScript('el.style.cssText="background-image: url(' + url + ')"'));
        strictEqual(getProperty(el.style, 'cssText'), 'background-image: ' + getExpected(url) + ';', 'cssText');
        strictEqual(el.style.cssText, 'background-image: ' + getExpected(proxyUrl) + ';', 'cssText');

        eval(processScript('el.style.cursor="url(' + url + '), auto"'));
        strictEqual(getProperty(el.style, 'cursor'), getExpected(url) + ', auto', 'cursor');
        strictEqual(el.style.cursor, getExpected(proxyUrl) + ', auto', 'cursor');
    });
}

test('get style body', function () {
    var style     = document.createElement('style');
    var styleText = 'div{background:url(http://some.domain.com/image.png)}';

    eval(processScript('style.innerHTML = styleText'));

    strictEqual(eval(processScript('style.innerHTML')), styleText);
    strictEqual(eval(processScript('style.innerText')).replace(/\s/g, ''), styleText);
    strictEqual(eval(processScript('style.textContent')), styleText);

    if (typeof style.text === 'string')
        strictEqual(eval(processScript('style.text')), styleText);
});

test('document.scripts', function () {
    var scriptsCollectionLength = eval(processScript('document.scripts')).length;
    var scriptEl                = document.createElement('script');

    scriptEl.className = SHADOW_UI_CLASSNAME.script;
    document.body.appendChild(scriptEl);

    strictEqual(scriptsCollectionLength, eval(processScript('document.scripts')).length);

    document.body.removeChild(scriptEl);
});

test('clean up outerHTML', function () {
    var htmlText = '<a href="http://domain.com/">link</a>';
    var div      = document.createElement('div');

    setProperty(div, 'innerHTML', htmlText);

    var a = div.firstChild;

    strictEqual(a.outerHTML, processHtml(htmlText));
    strictEqual(getProperty(a, 'outerHTML'), htmlText);

    // NOTE: This code checks PropertyAccessorsInstrumentation.attach(window).outerHTML.condition
    if (browserUtils.isIE && !browserUtils.isMSEdge) {
        var doc = document.implementation.createDocument(null, 'status', null);

        strictEqual(getProperty(doc.documentElement, 'outerHTML'), void 0);
    }
});

asyncTest('xhr.responseURL', function () {
    var xhr       = new XMLHttpRequest();
    var testCount = 0;

    xhr.addEventListener('readystatechange', function () {
        if (this.responseURL) {
            strictEqual(getProperty(this, 'responseURL'), 'https://example.com/xhr-large-response');
            ++testCount;
        }

        if (this.readyState === XMLHttpRequest.DONE) {
            expect(testCount);
            start();
        }
    });
    xhr.open('GET', '/redirect/', true);
    xhr.send(null);
});

module('regression');

test('changing the link.href property must affect the stored attribute value (T123960)', function () {
    var link     = $('<a>')[0];
    var url      = '/path?param=value';
    var proxyUrl = urlUtils.getProxyUrl(url);

    setProperty(link, 'href', url);
    strictEqual(link.href, proxyUrl);
    strictEqual(getProperty(link, 'href'), urlUtils.parseProxyUrl(proxyUrl).destUrl);

    eval(processScript('link.pathname="newPath"'));
    ok(/newPath$/.test(getProperty(link, 'pathname')));
    strictEqual(link.href, urlUtils.getProxyUrl('/newPath?param=value'));
    ok(/\/newPath\?param=value$/.test(getProperty(link, 'href')));
});

test('get script body (T296958) (GH-183)', function () {
    var script              = document.createElement('script');
    var scriptCode          = 'var test = window.href;';
    var processedScriptCode = processScript(scriptCode, true);
    var cleanedScriptCode   = removeProcessingHeader(processedScriptCode);

    setProperty(script, 'textContent', scriptCode);

    notEqual(script.textContent, scriptCode);
    strictEqual(script.textContent.replace(/\s/g, ''), processedScriptCode.replace(/\s/g, ''));
    strictEqual(cleanedScriptCode.indexOf(INTERNAL_PROPS.processDomMethodName), -1);
    strictEqual(getProperty(script, 'text'), cleanedScriptCode);
    strictEqual(getProperty(script, 'textContent'), cleanedScriptCode);
    strictEqual(getProperty(script, 'innerHTML'), cleanedScriptCode);

    if (typeof script.innerText === 'string')
        strictEqual(getProperty(script, 'innerText').replace(/\s/g, ''), cleanedScriptCode.replace(/\s/g, ''));
});

test('the getAttributesProperty function should work correctly if Function.prototype.bind is removed (GH-359)', function () {
    var storedBind = Function.prototype.bind;
    var a          = document.createElement('a');
    var withError  = false;

    a.href = 'test';
    delete Function.prototype.bind;

    try {
        var attrs = attributesProperty.getAttributesProperty(a);

        strictEqual(attrs.getNamedItem('href').value, 'test');
    }
    catch (e) {
        withError = true;
    }
    finally {
        ok(!withError);

        /* eslint-disable no-extend-native */
        Function.prototype.bind = storedBind;
        /* eslint-enable no-extend-native */
    }
});

test('script.innerHtml must be cleaned up (T226885)', function () {
    var code   = 'var t = 1;';
    var script = document.createElement('script');

    script.appendChild(document.createTextNode(code));
    notEqual(script.innerHTML.replace(/^\s*|\s*$/g, ''), code);
    strictEqual(eval(processScript('script.innerHTML')).replace(/^\s*|\s*$/g, ''), code);
});

test('should not create proxy url for invalid url (GH-778)', function () {
    var link       = document.createElement('a');
    var nativeLink = nativeMethods.createElement.call(document, 'a');

    var testCases = [
        {
            value:     '//:0',
            skipForIE: false
        },
        {
            value:     '//:0/',
            skipForIE: false
        },
        {
            value:     'http://test:0',
            skipForIE: false
        },
        {
            value:     'http://test:123456789',
            skipForIE: true
        }
    ];

    for (var i = 0; i < testCases.length; i++) {
        // NOTE: https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/9513048/
        if (browserUtils.isIE && testCases[i].skipForIE)
            continue;

        var linkVal       = link.setAttribute('href', testCases[i]);
        var nativeLinkVal = nativeLink.setAttribute('href', testCases[i]);

        strictEqual(linkVal, nativeLinkVal);
    }
});
