var urlUtils      = hammerhead.get('./utils/url');
var nativeMethods = hammerhead.nativeMethods;
var StyleSandbox  = hammerhead.get('./sandbox/style');
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

    div.setAttribute('style', 'background-image:url(index.png);');

    var actualBackgroundImageValue = removeDoubleQuotes(getNativeStylePropValue(div, 'background-image'));

    strictEqual(actualBackgroundImageValue, removeDoubleQuotes(proxiedBackgroundImageValue));
    strictEqual(div.getAttribute('style'), 'background-image:url(index.png);');
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
    var actualRule = removeDoubleQuotes(document.styleSheets[0].rules[0].cssText);

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
        var dashedProp         = StyleSandbox._convertToDashed(prop);
        var dashedAffectedProp = StyleSandbox._convertToDashed(affectedProp);

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
