var browserUtils    = Hammerhead.get('./utils/browser');
var nativeMethods   = Hammerhead.get('./sandbox/native-methods');
var urlUtils        = Hammerhead.get('./utils/url');
var scriptProcessor = Hammerhead.get('../processing/script');
var Const           = Hammerhead.get('../const');

var shadowUI      = Hammerhead.sandbox.shadowUI;
var iframeSandbox = Hammerhead.sandbox.iframe;

QUnit.testStart(function () {
    iframeSandbox.on(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, initIFrameTestHandler);
    iframeSandbox.off(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, initIFrameTestHandler);
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

    var proxyLocation = urlUtils.OriginLocation.get();

    strictEqual(eval(processScript('$scriptWithSrc[0].src')), 'http://some.com/script.js');
    strictEqual(eval(processScript('$scriptWithEmptySrc[0].src')), proxyLocation);
    strictEqual(eval(processScript('$scriptWithoutSrc[0].src')), '');
    strictEqual(eval(processScript('$linkWithOnlyHash[0].href')), proxyLocation + '#hash');
    /* eslint-enable no-unused-vars */
});

test('attributes', function () {
    var link       = $('<a href="http://some.com/" rel="x">')[0];
    var attributes = null;

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

    strictEqual(url, urlUtils.OriginLocation.get());
});

test('document.referrer', function () {
    var url          = 'http://google.com/index.html';
    var documentMock = {
        referrer: urlUtils.getProxyUrl(url),
        toString: function () {
            return '[object HTMLDocument]';
        }
    };

    strictEqual(getProperty(documentMock, 'referrer'), url);
});

if (browserUtils.isWebKit) {
    test('url in stylesheet properties', function () {
        var el       = document.createElement('div');
        var url      = 'http://google.com/image.png';
        var proxyUrl = urlUtils.getProxyUrl(url);

        eval(processScript('el.style.backgroundImage="url(' + url + ')"'));
        strictEqual(getProperty(el.style, 'backgroundImage'), 'url(' + url +
                                                              ')', 'backgroundImage');
        strictEqual(el.style.backgroundImage, 'url(' + proxyUrl + ')', 'backgroundImage');

        eval(processScript('el.style.background="url(' + url + ')"'));
        strictEqual(getProperty(el.style, 'background'), 'url(' + url + ')', 'background');
        strictEqual(el.style.background, 'url(' + proxyUrl + ')', 'background');

        eval(processScript('el.style.listStyle="url(' + url + ')"'));
        strictEqual(getProperty(el.style, 'listStyle'), 'url(' + url + ')', 'listStyle');
        strictEqual(el.style.listStyle, 'url(' + proxyUrl + ')', 'listStyle');

        eval(processScript('el.style.listStyleImage="url(' + url + ')"'));
        strictEqual(getProperty(el.style, 'listStyleImage'), 'url(' + url +
                                                             ')', 'listStyleImage');
        strictEqual(el.style.listStyleImage, 'url(' + proxyUrl + ')', 'listStyleImage');

        eval(processScript('el.style.cssText="background-image: url(' + url + ')"'));
        strictEqual(getProperty(el.style, 'cssText'), 'background-image: url(' + url +
                                                      ');', 'cssText');
        strictEqual(el.style.cssText, 'background-image: url(' + proxyUrl + ');', 'cssText');

        eval(processScript('el.style.cursor="url(' + url + '), auto"'));
        strictEqual(getProperty(el.style, 'cursor'), 'url(' + url + '), auto', 'cursor');
        strictEqual(el.style.cursor, 'url(' + proxyUrl + '), auto', 'cursor');
    });
}

module('regression');

test('changing the link.href property must affect the stored attribute value (T123960)', function () {
    var link     = $('<a>')[0];
    var url      = '/path?param=value';
    var proxyUrl = urlUtils.getProxyUrl(url);

    setProperty(link, 'href', url);
    strictEqual(link.href, proxyUrl);
    strictEqual(getProperty(link, 'href'), urlUtils.parseProxyUrl(proxyUrl).originUrl);

    eval(processScript('link.pathname="newPath"'));
    ok(/newPath$/.test(getProperty(link, 'pathname')));
    strictEqual(link.href, urlUtils.getProxyUrl('/newPath?param=value'));
    ok(/\/newPath\?param=value$/.test(getProperty(link, 'href')));
});

test('get script body (T296958) (GH-183)', function () {
    var script              = document.createElement('script');
    var scriptCode          = 'var test = window.href;';
    var processedScriptCode = scriptProcessor.process(scriptCode);
    var cleanedScriptCode   = scriptProcessor.cleanUpHeader(processedScriptCode);

    eval(scriptProcessor.process('script.textContent="' + scriptCode + '"'));

    notEqual(script.textContent, scriptCode);
    strictEqual(script.textContent.replace(/\s/g, ''), processedScriptCode.replace(/\s/g, ''));
    strictEqual(cleanedScriptCode.indexOf(Const.DOM_SANDBOX_OVERRIDE_DOM_METHOD_NAME), -1);
    strictEqual(eval(scriptProcessor.process('script.text')), cleanedScriptCode);
    strictEqual(eval(scriptProcessor.process('script.textContent')), cleanedScriptCode);
    strictEqual(eval(scriptProcessor.process('script.innerHTML')), cleanedScriptCode);

    if (typeof script.innerText === 'string')
        strictEqual(eval(scriptProcessor.process('script.innerText')).replace(/\s/g, ''), cleanedScriptCode.replace(/\s/g, ''));
});

