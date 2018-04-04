var urlUtils      = hammerhead.get('./utils/url');
var nativeMethods = hammerhead.nativeMethods;
var StyleSandbox  = hammerhead.get('./sandbox/node/element/style');
var styleSandbox  = hammerhead.sandbox.node.element.styleSandbox;

function getNativeStylePropValue (el, prop) {
    var nativeStyle = nativeMethods.htmlElementStyleGetter.call(el);

    return nativeMethods.styleGetPropertyValue.call(nativeStyle, prop);
}

function setNativeStyleProp (el, prop, value) {
    var nativeStyle = nativeMethods.htmlElementStyleGetter.call(el);

    return nativeMethods.styleSetProperty.call(nativeStyle, prop, value);
}

test('check the "scriptElementEvent" event is raised', function () {
    var script1           = document.createElement('script');
    var addedScriptsCount = 0;
    var scripts           = [];

    function handler (e) {
        strictEqual(e.el, scripts[addedScriptsCount]);

        ++addedScriptsCount;
    }

    hammerhead.on(hammerhead.EVENTS.scriptElementAdded, handler);

    scripts.push(script1);

    document.body.appendChild(script1);

    strictEqual(addedScriptsCount, 1);

    var fragment = document.createDocumentFragment();

    var script2 = document.createElement('script');
    var script3 = document.createElement('script');

    fragment.appendChild(script2);
    fragment.appendChild(script3);

    strictEqual(addedScriptsCount, 1);

    scripts.push(script2, script3);

    document.body.appendChild(fragment);

    strictEqual(addedScriptsCount, 3);

    var div     = document.createElement('div');
    var script4 = document.createElement('script');

    div.appendChild(script4);

    strictEqual(addedScriptsCount, 3);

    scripts.push(script4);

    document.body.appendChild(div);

    strictEqual(addedScriptsCount, 4);

    hammerhead.off(hammerhead.EVENTS.scriptElementAdded, handler);
});

module('styles');

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
