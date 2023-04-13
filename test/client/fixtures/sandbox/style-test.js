var urlUtils      = hammerhead.utils.url;
var nativeMethods = hammerhead.nativeMethods;
var StyleSandbox  = hammerhead.sandboxes.StyleSandbox;
var styleSandbox  = hammerhead.sandbox.style;

function getNativeStylePropValue (el, prop) {
    var nativeStyle = nativeMethods.htmlElementStyleGetter.call(el);

    return nativeMethods.styleGetPropertyValue.call(nativeStyle, prop);
}

function setNativeStyleProp (el, prop, value) {
    var nativeStyle = nativeMethods.htmlElementStyleGetter.call(el);

    return nativeMethods.styleSetProperty.call(nativeStyle, prop, value);
}

test('set the "style" property', function () {
    var div = document.createElement('div');
    var url = '/image.jpg';

    div.style = 'background-image:url("' + url + '")';

    var actualBackgroundImageValue   = removeDoubleQuotes(getNativeStylePropValue(div, 'background-image'));
    var expectedBackgroundImageValue = nativeMethods.htmlElementStyleSetter
        ? removeDoubleQuotes('url("' + urlUtils.getProxyUrl(url) + '")')
        : '';

    strictEqual(actualBackgroundImageValue, expectedBackgroundImageValue);
});

test('set the "style" attribute', function () {
    var div                         = document.createElement('div');
    var proxiedBackgroundImageValue = 'url("' + urlUtils.getProxyUrl('index.png') + '")';

    div.setAttribute('style', 'background-image: url(index.png);');

    var actualBackgroundImageValue = removeDoubleQuotes(getNativeStylePropValue(div, 'background-image'));

    strictEqual(actualBackgroundImageValue, removeDoubleQuotes(proxiedBackgroundImageValue));

    var getAttributeResult = 'background-image: url("' + urlUtils.resolveUrlAsDest('index.png') + '");';

    getAttributeResult = removeDoubleQuotes(getAttributeResult);

    strictEqual(div.getAttribute('style'), getAttributeResult);
});

test('cssText', function () {
    var div      = document.createElement('div');
    var url      = '/image.png';
    var proxyUrl = urlUtils.getProxyUrl(url);

    div.style.cssText = 'background-image:url("' + url + '")';

    var actualBackgroundImageValue   = removeDoubleQuotes(getNativeStylePropValue(div, 'background-image'));
    var expectedBackgroundImageValue = removeDoubleQuotes('url("' + proxyUrl + '")');

    strictEqual(actualBackgroundImageValue, expectedBackgroundImageValue);
    strictEqual(div.style.cssText.indexOf(proxyUrl), -1);
});

test('insertRule', function () {
    var style    = document.createElement('style');
    var url      = '/image.png';
    var proxyUrl = urlUtils.getProxyUrl(url);

    document.head.appendChild(style);

    var actualRuleIndex = document.styleSheets[0].insertRule('div { background-image: url("' + url + '"); }');
    var actualRules = document.styleSheets[0].rules || document.styleSheets[0].cssRules;
    var actualRule = removeDoubleQuotes(actualRules[0].cssText);

    strictEqual(actualRuleIndex, 0);
    strictEqual(actualRule, removeDoubleQuotes('div { background-image: url("' + proxyUrl + '")' + '; }'));
});

test('url properties', function () {
    var div      = document.createElement('div');
    var url      = 'http://some.domain.com/image.png';
    var proxyUrl = urlUtils.getProxyUrl(url);
    var value    = 'url(' + url + ')';

    styleSandbox.URL_PROPS.forEach(function (prop) {
        // NOTE: If we setup `borderImage` property then it affects a `borderImageSource` property.
        var affectedProp       = prop === 'borderImage' ? 'borderImageSource' : prop;
        var dashedProp         = StyleSandbox.convertToDashed(prop);
        var dashedAffectedProp = StyleSandbox.convertToDashed(affectedProp);

        setNativeStyleProp(div, dashedProp, value);

        var nativeValue  = getNativeStylePropValue(div, dashedAffectedProp);
        var proxiedValue = nativeValue && nativeValue.replace(url, proxyUrl);

        div.style.removeProperty(dashedProp);

        div.style[prop] = value;

        strictEqual(div.style[affectedProp], nativeValue, prop + ' dest');
        strictEqual(getNativeStylePropValue(div, dashedAffectedProp), proxiedValue, prop + ' proxy');

        if (prop !== dashedProp) {
            div.style.removeProperty(dashedProp);

            div.style[dashedProp] = value;

            strictEqual(div.style[dashedAffectedProp], nativeValue, dashedProp + ' dest');
            strictEqual(getNativeStylePropValue(div, dashedAffectedProp), proxiedValue, dashedProp + ' proxy');
        }
    });
});

test('getPropertyValue, setProperty, getPropertyValue (GH-1212)', function () {
    var div      = document.createElement('div');
    var url      = 'http://some.domain.com/image.png';
    var proxyUrl = urlUtils.getProxyUrl(url);

    div.style.setProperty('background', 'url(' + url + ')', '');

    ok(getNativeStylePropValue(div, 'background').indexOf(proxyUrl) !== -1);
    ok(div.style.getPropertyValue('background').indexOf(proxyUrl) === -1);
    ok(div.style.getPropertyValue('background').indexOf(url) !== -1);

    var oldValue = div.style.removeProperty('background');

    ok(oldValue.indexOf(proxyUrl) === -1);

    div.style.setProperty('background', null);

    ok(!div.style.background);
    ok(!div.style.getPropertyValue('background'));
    ok(!div.style.removeProperty('background'));
});

test('wrappers of native functions should return the correct string representations', function () {
    window.checkStringRepresentation(window.CSSStyleSheet.prototype.insertRule, nativeMethods.styleInsertRule,
        'CSSStyleSheet.prototype.insertRule');
    window.checkStringRepresentation(window.CSSStyleDeclaration.prototype.getPropertyValue,
        nativeMethods.styleGetPropertyValue,
        'CSSStyleDeclaration.prototype.getPropertyValue');
    window.checkStringRepresentation(window.CSSStyleDeclaration.prototype.setProperty, nativeMethods.styleSetProperty,
        'CSSStyleDeclaration.prototype.setProperty');
    window.checkStringRepresentation(window.CSSStyleDeclaration.prototype.removeProperty,
        nativeMethods.styleRemoveProperty,
        'CSSStyleDeclaration.prototype.removeProperty');
});

module('regression');

test('the getAttribute function should return cleaned style (GH-1922)', function () {
    var div = document.createElement('div');

    div.setAttribute('style', 'background-color: red;');

    strictEqual(div.getAttribute('style'), 'background-color: red;');

    div.style.backgroundColor = 'green';

    strictEqual(div.getAttribute('style'), 'background-color: green;');

    div.style.display = 'none';

    strictEqual(div.getAttribute('style'), 'background-color: green; display: none;');
});

test('the appendData function should append processed text (TC-3830)', function () {
    const style    = document.createElement('style');
    const textNode = document.createTextNode('');

    style.appendChild(textNode);

    textNode.appendData('\n.class:hover{}\n');

    strictEqual(textNode.data, '\n.class[data-hammerhead-hovered]{}\n');
});

test('the appendData function does not break if there is no parent element (TC-3830)', function () {
    const textNode = document.createTextNode('');

    textNode.appendData('\n.class:hover{}\n');

    strictEqual(textNode.data, '\n.class:hover{}\n');
});

test('override properties in the CSSStyleDeclaration.prototype (GH-7166)', function () {
    return createTestIframe({ src: getSameDomainPageUrl('../../data/style-sandbox/index.html') })
        .then(function (iframe) {
            var iframeDocument = iframe.contentDocument;
            var item           = iframeDocument.querySelector('div');

            strictEqual(removeDoubleQuotes(item.style.backgroundImage), 'url(https://domain.com/test.svg)');
            strictEqual(removeDoubleQuotes(item.style.backgroundImage), 'url(https://domain.com/test.svg)');
        });
});
