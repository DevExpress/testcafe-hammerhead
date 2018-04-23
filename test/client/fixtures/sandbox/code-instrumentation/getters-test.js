var urlUtils                             = hammerhead.get('./utils/url');
var processScript                        = hammerhead.get('../processing/script').processScript;
var destLocation                         = hammerhead.get('./utils/destination-location');
var attributesProperty                   = hammerhead.get('../client/sandbox/code-instrumentation/properties/attributes');
var DomProcessor                         = hammerhead.get('../processing/dom');
var urlResolver                          = hammerhead.get('./utils/url-resolver');

var browserUtils  = hammerhead.utils.browser;
var nativeMethods = hammerhead.nativeMethods;

test('autocomplete', function () {
    var input  = document.createElement('input');
    var etalon = nativeMethods.createElement.call(document, 'input');

    strictEqual(input.autocomplete, nativeMethods.inputAutocompleteGetter.call(etalon));
    strictEqual(nativeMethods.getAttribute.call(input, 'autocomplete'), 'off');

    input.setAttribute('autocomplete', 'off');
    nativeMethods.setAttribute.call(etalon, 'autocomplete', 'off');
    strictEqual(input.autocomplete, nativeMethods.inputAutocompleteGetter.call(etalon));
    strictEqual(nativeMethods.getAttribute.call(input, 'autocomplete'), 'off');

    input.setAttribute('autocomplete', 'on');
    nativeMethods.setAttribute.call(etalon, 'autocomplete', 'on');
    strictEqual(input.autocomplete, nativeMethods.inputAutocompleteGetter.call(etalon));
    strictEqual(nativeMethods.getAttribute.call(input, 'autocomplete'), 'off');

    input.setAttribute('autocomplete', '');
    nativeMethods.setAttribute.call(etalon, 'autocomplete', '');
    strictEqual(input.autocomplete, nativeMethods.inputAutocompleteGetter.call(etalon));
    strictEqual(nativeMethods.getAttribute.call(input, 'autocomplete'), 'off');

    input.removeAttribute('autocomplete');
    nativeMethods.removeAttribute.call(etalon, 'autocomplete');
    strictEqual(input.autocomplete, nativeMethods.inputAutocompleteGetter.call(etalon));
    strictEqual(nativeMethods.getAttribute.call(input, 'autocomplete'), 'off');
});

test('url', function () {
    /* eslint-disable no-unused-vars */
    var $scriptWithSrc      = $('<script src="http://some.com/script.js">');
    var $scriptWithEmptySrc = $('<script src="">');
    var $scriptWithoutSrc   = $('<script>');
    var $linkWithOnlyHash   = $('<a href="#hash">');

    var proxyLocation = destLocation.get();

    strictEqual($scriptWithSrc[0].src, 'http://some.com/script.js');
    strictEqual($scriptWithEmptySrc[0].src, proxyLocation);
    strictEqual($scriptWithoutSrc[0].src, '');
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

test('CSSStyleSheet.href', function () {
    var style = document.createElement('style');

    document.body.appendChild(style);

    var storedGetProxyUrl = urlUtils.parseProxyUrl;
    var styleSheet        = document.styleSheets[0];

    urlUtils.parseProxyUrl = function () {
        return { destUrl: 'expected-url' };
    };

    strictEqual(styleSheet.href, 'expected-url');

    urlUtils.parseProxyUrl = storedGetProxyUrl;
    document.body.removeChild(style);
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

test('input.formaction, button.formaction', function () {
    var button = document.createElement('button');
    var input  = document.createElement('input');

    button.formAction = './button.html';
    input.formAction  = './input.html';

    strictEqual(nativeMethods.getAttribute.call(button, 'formaction'), urlUtils.getProxyUrl('./button.html', { resourceType: 'f' }));
    strictEqual(nativeMethods.getAttribute.call(input, 'formaction'), urlUtils.getProxyUrl('./input.html', { resourceType: 'f' }));
});

test('SVGImageElement with href attribute (GH-1502)', function () {
    var svgNameSpaceUrl = 'http://www.w3.org/2000/svg';
    var svgImage        = document.createElementNS(svgNameSpaceUrl, 'image');
    var nativeSvgImage  = nativeMethods.createElementNS.call(document, svgNameSpaceUrl, 'image');
    var url             = 'http://domain.com/test.svg';
    var proxyUrl        = urlUtils.getProxyUrl(url);

    svgImage.href.baseVal = url;
    nativeMethods.svgAnimStrBaseValSetter.call(nativeMethods.svgImageHrefGetter.call(nativeSvgImage), url);

    strictEqual(nativeMethods.svgAnimStrAnimValGetter.call(svgImage.href), proxyUrl);
    strictEqual(nativeMethods.svgAnimStrBaseValGetter.call(svgImage.href), proxyUrl);
    strictEqual(svgImage.href.animVal, nativeSvgImage.href.animVal);
    strictEqual(svgImage.href.baseVal, nativeSvgImage.href.baseVal);

    var hrefStroredAttrName = DomProcessor.getStoredAttrName.call(svgImage, 'href');

    strictEqual(nativeMethods.getAttribute.call(svgImage, hrefStroredAttrName), url);
    strictEqual(svgImage.getAttribute('href'), nativeMethods.getAttribute.call(nativeSvgImage, 'href'));
});

test('SVGImageElement with xlink:href attribute (GH-1502)', function () {
    var svgNameSpaceUrl   = 'http://www.w3.org/2000/svg';
    var xlinkNameSpaceUrl = 'http://www.w3.org/1999/xlink';
    var svgImage          = document.createElementNS(svgNameSpaceUrl, 'image');
    var nativeSvgImage    = nativeMethods.createElementNS.call(document, svgNameSpaceUrl, 'image');
    var url               = 'http://domain.com/test.svg';

    svgImage.setAttributeNS(xlinkNameSpaceUrl, 'href', url);
    nativeMethods.setAttributeNS.call(nativeSvgImage, xlinkNameSpaceUrl, 'href', url);

    var hrefStroredAttrName = DomProcessor.getStoredAttrName.call(svgImage, 'href');

    strictEqual(nativeMethods.getAttributeNS.call(svgImage, xlinkNameSpaceUrl, hrefStroredAttrName), url);
    strictEqual(svgImage.getAttributeNS(xlinkNameSpaceUrl, 'href'), nativeMethods.getAttributeNS.call(nativeSvgImage, xlinkNameSpaceUrl, 'href'));
});

module('regression');

test('changing the link.href property must affect the stored attribute value (T123960)', function () {
    var anchor   = document.createElement('a');
    var url      = '/path?param=value';
    var proxyUrl = urlUtils.getProxyUrl(url);

    anchor.href = url;

    strictEqual(nativeMethods.anchorHrefGetter.call(anchor), proxyUrl);
    strictEqual(anchor.href, urlUtils.parseProxyUrl(proxyUrl).destUrl);

    anchor.pathname = 'newPath';

    ok(/newPath$/.test(anchor.pathname));
    strictEqual(nativeMethods.anchorHrefGetter.call(anchor), urlUtils.getProxyUrl('/newPath?param=value'));
    ok(/\/newPath\?param=value$/.test(anchor.href));
});

test('the getAttributesProperty function should work correctly if Function.prototype.bind is removed (GH-359)', function () {
    var storedBind = Function.prototype.bind;
    var anchor     = document.createElement('a');
    var withError  = false;

    nativeMethods.anchorHrefSetter.call(anchor, 'test');

    delete Function.prototype.bind;

    try {
        var attrs = attributesProperty.getAttributesProperty(anchor);

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

test('should not create proxy url for invalid url (GH-778)', function () {
    var anchor       = document.createElement('a');
    var nativeAnchor = nativeMethods.createElement.call(document, 'a');

    var testCases = [
        {
            value:     '//',
            skipForIE: false
        },
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

    var storedBaseUrl = urlResolver.getBaseUrl(document);

    urlResolver.updateBase(location.origin, document);

    for (var i = 0; i < testCases.length; i++) {
        // NOTE: https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/9513048/
        if (browserUtils.isIE && testCases[i].skipForIE)
            continue;

        anchor.setAttribute('href', testCases[i].value);
        nativeMethods.setAttribute.call(nativeAnchor, 'href', testCases[i].value);

        strictEqual(anchor.getAttribute('href'), nativeMethods.getAttribute.call(nativeAnchor, 'href'));
        strictEqual(anchor.href, nativeMethods.anchorHrefGetter.call(nativeAnchor));
    }

    urlResolver.updateBase(storedBaseUrl, document);
});

test('getProperty function should not throw an error for document.all property (GH-1046)', function () {
    try {
        strictEqual(getProperty(document.all, 0), document.documentElement);
    }
    catch (e) {
        ok(false);
    }
});
