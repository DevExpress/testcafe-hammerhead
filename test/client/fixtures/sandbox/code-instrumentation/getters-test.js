var INTERNAL_PROPS                       = hammerhead.get('../processing/dom/internal-properties');
var urlUtils                             = hammerhead.get('./utils/url');
var processScript                        = hammerhead.get('../processing/script').processScript;
var removeProcessingHeader               = hammerhead.get('../processing/script/header').remove;
var SCRIPT_PROCESSING_START_COMMENT      = hammerhead.get('../processing/script/header').SCRIPT_PROCESSING_START_COMMENT;
var SCRIPT_PROCESSING_END_COMMENT        = hammerhead.get('../processing/script/header').SCRIPT_PROCESSING_END_COMMENT;
var SCRIPT_PROCESSING_END_HEADER_COMMENT = hammerhead.get('../processing/script/header').SCRIPT_PROCESSING_END_HEADER_COMMENT;
var styleProcessor                       = hammerhead.get('../processing/style');
var destLocation                         = hammerhead.get('./utils/destination-location');
var attributesProperty                   = hammerhead.get('../client/sandbox/code-instrumentation/properties/attributes');
var processHtml                          = hammerhead.get('../client/utils/html').processHtml;

var browserUtils  = hammerhead.utils.browser;
var nativeMethods = hammerhead.nativeMethods;
var shadowUI      = hammerhead.sandbox.shadowUI;
var iframeSandbox = hammerhead.sandbox.iframe;

QUnit.testStart(function () {
    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT_EVENT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, initIframeTestHandler);
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
    var url                  = 'http://some.domain.com/index.html';
    var storedObjectToString = nativeMethods.objectToString;
    var documentMock         = {
        referrer: urlUtils.getProxyUrl(url)
    };

    nativeMethods.objectToString = function () {
        return Object.prototype.toString.call(document);
    };

    strictEqual(getProperty(documentMock, 'referrer'), url);

    nativeMethods.objectToString = storedObjectToString;
});

test('document.documentURI', function () {
    var url                  = 'http://some.domain.com/index.html';
    var storedObjectToString = nativeMethods.objectToString;
    var documentMock         = {
        documentURI: urlUtils.getProxyUrl(url)
    };

    nativeMethods.objectToString = function () {
        return Object.prototype.toString.call(document);
    };

    strictEqual(getProperty(documentMock, 'documentURI'), url);

    nativeMethods.objectToString = storedObjectToString;
});

test("should returns a native 'document.documentURI' property value if it does not supported (GH-1270)", function () {
    if (!document.documentURI)
        strictEqual(document.documentURI, getProperty(document, 'documentURI'));
    else
        expect(0);
});

test('document.baseURI (GH-920)', function () {
    var url                  = 'http://some.domain.com/index.html';
    var storedObjectToString = nativeMethods.objectToString;
    var documentMock         = {
        baseURI: urlUtils.getProxyUrl(url)
    };

    nativeMethods.objectToString = function () {
        return Object.prototype.toString.call(document);
    };

    strictEqual(getProperty(documentMock, 'baseURI'), url);

    nativeMethods.objectToString = storedObjectToString;
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

test('url in stylesheet properties', function () {
    var el            = document.createElement('div');
    var url           = 'http://some.domain.com/image.png';
    var proxyUrl      = urlUtils.getProxyUrl(url);
    var cssProperties = ['background', 'backgroundImage', 'background-image', 'borderImage', 'border-image',
        'borderImageSource', 'border-image-source', 'listStyle', 'list-style', 'listStyleImage',
        'list-style-image', 'cssText', 'cursor'];

    cssProperties.forEach(function (prop) {
        var value = 'url(' + url + ')';

        // NOTE: We cannot get url through 'borderImage' or 'border-image' properties
        var propForChecking = prop === 'borderImage' || prop === 'border-image' ? 'borderImageSource' : prop;

        if (prop === 'cssText')
            value = 'background:' + value;

        el.style[prop] = value;

        var etalonValue  = el.style[propForChecking];
        var proxiedValue = etalonValue.replace(url, proxyUrl);

        eval(processScript('el.style["' + prop + '"]="' + value + '"'));
        strictEqual(getProperty(el.style, propForChecking), etalonValue, prop);
        strictEqual(el.style[propForChecking], proxiedValue, prop);
    });
});

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

    shadowUI.addClass(scriptEl, 'script');
    document.body.appendChild(scriptEl);

    strictEqual(scriptsCollectionLength, eval(processScript('document.scripts')).length);

    document.body.removeChild(scriptEl);
});

test('document.styleSheets (GH-1000)', function () {
    var styleSheetsCollectionLength = eval(processScript('document.styleSheets')).length;
    var shadowStyleSheet            = document.createElement('style');

    shadowUI.addClass(shadowStyleSheet, 'ui-stylesheet');
    document.body.appendChild(shadowStyleSheet);

    strictEqual(styleSheetsCollectionLength, eval(processScript('document.styleSheets')).length);

    var styleSheet = document.createElement('style');

    document.body.appendChild(styleSheet);

    var proxiedStyleSheetsCollection = getProperty(document, 'styleSheets');

    strictEqual(styleSheet, proxiedStyleSheetsCollection.item(0).ownerNode);

    shadowStyleSheet.parentNode.removeChild(shadowStyleSheet);
    styleSheet.parentNode.removeChild(styleSheet);
});

test('input.formaction, button.formaction', function () {
    var button = document.createElement('button');
    var input  = document.createElement('input');

    setProperty(button, 'formAction', './button.html');
    setProperty(input, 'formAction', './input.html');

    strictEqual(nativeMethods.getAttribute.call(button, 'formaction'), urlUtils.getProxyUrl('./button.html', { resourceType: 'f' }));
    strictEqual(nativeMethods.getAttribute.call(input, 'formaction'), urlUtils.getProxyUrl('./input.html', { resourceType: 'f' }));
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

test('document.cookie on page with file protocol', function () {
    destLocation.forceLocation('http://localhost/sessionId/file:///path/index.html');

    strictEqual(setProperty(document, 'cookie', 'test=123'), 'test=123');
    strictEqual(getProperty(document, 'cookie'), '');

    destLocation.forceLocation('http://localhost/sessionId/https://example.com');
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
    strictEqual(getProperty(script, 'text'), cleanedScriptCode, 'text');
    strictEqual(getProperty(script, 'textContent'), cleanedScriptCode, 'textContent');
    strictEqual(getProperty(script, 'innerHTML'), cleanedScriptCode, 'innerHTML');

    if (typeof script.innerText === 'string')
        strictEqual(getProperty(script, 'innerText').replace(/\s/g, ''), cleanedScriptCode.replace(/\s/g, ''), 'innerText');
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

function checkProperty (text) {
    return text.indexOf(SCRIPT_PROCESSING_START_COMMENT) === -1 &&
           text.indexOf(SCRIPT_PROCESSING_END_COMMENT) === -1 &&
           text.indexOf(SCRIPT_PROCESSING_END_HEADER_COMMENT) === -1 &&
           text.indexOf(styleProcessor.STYLESHEET_PROCESSING_START_COMMENT) === -1 &&
           text.indexOf(styleProcessor.STYLESHEET_PROCESSING_END_COMMENT) === -1;
}

test('we should clean up hammerhead script and style for all elements(GH-1079)', function () {
    var head         = document.head;
    var style        = document.createElement('style');
    var styleText    = 'div{background:url(http://some.domain.com/image.png)}';
    var firstScript  = document.createElement('script');
    var secondScript = document.createElement('script');
    var scriptCode   = 'var test = window.href;';

    setProperty(style, 'textContent', styleText);
    head.appendChild(style);
    setProperty(firstScript, 'textContent', scriptCode);
    head.appendChild(firstScript);
    setProperty(secondScript, 'textContent', scriptCode);
    head.appendChild(secondScript);

    var text        = getProperty(firstScript, 'text') || '';
    var textContent = getProperty(head, 'textContent');
    var innerText   = getProperty(head, 'innerText') || '';
    var innerHTML   = getProperty(head, 'innerHTML');
    var outerHTML   = getProperty(head, 'outerHTML');

    head.removeChild(style);
    head.removeChild(firstScript);
    head.removeChild(secondScript);

    ok(checkProperty(text));
    ok(checkProperty(textContent));
    ok(checkProperty(innerText));
    ok(checkProperty(innerHTML));
    ok(checkProperty(outerHTML));
});

test('we should clean up html and remove extra namespaces from svg (GH-1083)', function () {
    var svg       = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    var a         = document.createElement('a');
    var div       = document.createElement('div');
    var nativeSvg = nativeMethods.createElementNS.call(document, 'http://www.w3.org/2000/svg', 'svg');
    var nativeA   = nativeMethods.createElement.call(document, 'a');
    var nativeDiv = nativeMethods.createElement.call(document, 'div');

    a.setAttribute('href', '/path');
    nativeMethods.setAttribute.call(nativeA, 'href', '/path');

    a.innerText = nativeA.innerHTML = 'link';

    svg.appendChild(a);
    nativeMethods.appendChild.call(nativeSvg, nativeA);

    div.appendChild(svg);
    nativeMethods.appendChild.call(nativeDiv, nativeSvg);

    strictEqual(getProperty(div, 'innerHTML'), nativeDiv.innerHTML);

    div.innerHTML = nativeDiv.innerHTML = '';

    svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    nativeMethods.setAttribute.call(nativeSvg, 'xmlns:xlink', 'http://www.w3.org/1999/xlink');

    div.appendChild(svg.cloneNode(true));
    nativeMethods.appendChild.call(nativeDiv, nativeMethods.cloneNode.call(nativeSvg, true));

    strictEqual(getProperty(div, 'innerHTML'), nativeDiv.innerHTML);

    // NOTE: IE added additional attributes with namespaces
    // such as 'xmlns:NS2=""', NS2:xmlns:ns1=""
    // after setting div.innerHTML property
    div.innerHTML       = div.innerHTML;
    nativeDiv.innerHTML = nativeDiv.innerHTML;

    div.appendChild(svg);
    nativeMethods.appendChild.call(nativeDiv, nativeSvg);

    strictEqual(getProperty(div, 'innerHTML'), nativeDiv.innerHTML);
});

test('we should not process element\'s properties if they do not exist (GH-1164)', function () {
    var div            = document.createElement('div');
    var svg            = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    var html           = '<a href="/path">link</a>';
    var processedHtml  = processHtml(html);
    var style          = 'body {}';
    var textProperties = ['innerText', 'textContent'];
    var styleElement   = document.createElement('style');

    div.appendChild(svg);

    var svgHasInnerHTML = svg.innerHTML !== void 0;

    strictEqual(getProperty(svg, 'innerHTML'), svg.innerHTML);

    // NOTE: Only MSEdge puts additional 'xmlns' attribute for svg child nodes
    svg.innerHTML = processedHtml;

    var processedHtmlInsideSvg = svg.innerHTML;

    setProperty(svg, 'innerHTML', html);

    strictEqual(svg.innerHTML, svgHasInnerHTML ? processedHtmlInsideSvg : html);

    svg.innerHTML = '';

    var svgHasOuterHTML = svg.outerHTML !== void 0;

    strictEqual(getProperty(svg, 'outerHTML'), svg.outerHTML);

    setProperty(svg, 'outerHTML', html);

    if (svgHasOuterHTML)
        strictEqual(div.innerHTML, processedHtml);
    else
        strictEqual(svg.outerHTML, html);

    setProperty(styleElement, 'innerHTML', style);

    svg.appendChild(styleElement);

    textProperties.forEach(function (property) {
        var svgHasProperty = svg[property] !== void 0;

        strictEqual(getProperty(svg, property), svgHasProperty ? style : void 0, property);
    });
});

test('document.activeElement when it equals null (GH-1226)', function () {
    expect(1);

    var div      = document.createElement('div');
    var innerDiv = document.createElement('div');

    div.id            = 'div';
    innerDiv.id       = 'innerDiv';
    innerDiv.tabIndex = 0;
    div.appendChild(innerDiv);
    document.body.appendChild(div);
    innerDiv.focus();
    setProperty(div, 'innerHTML', '<span>Replaced</span>');

    try {
        var instrumentedValue = getProperty(document, 'activeElement');

        strictEqual(instrumentedValue, document.activeElement);
    }
    catch (err) {
        ok(false);
    }

    div.parentNode.removeChild(div);
});
