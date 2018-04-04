var urlUtils      = hammerhead.get('./utils/url');
var nativeMethods = hammerhead.nativeMethods;

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

test('HTMLElement.style', function () {
    var div = document.createElement('div');
    var url = '/image.jpg';

    div.style = 'background-image:url("' + url + '")';

    var actualBackgroundImageValue   = removeDoubleQuotes(getNativeStylePropValue(div, 'background-image'));
    var expectedBackgroundImageValue = nativeMethods.htmlElementStyleSetter
        ? removeDoubleQuotes('url("' + urlUtils.getProxyUrl(url) + '")')
        : '';

    strictEqual(actualBackgroundImageValue, expectedBackgroundImageValue);
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

test('url in stylesheet properties', function () {
    var div           = document.createElement('div');
    var url           = 'http://some.domain.com/image.png';
    var proxyUrl      = urlUtils.getProxyUrl(url);
    var cssProperties = ['background', 'backgroundImage', 'background-image', 'borderImage', 'border-image', 'cursor',
        'borderImageSource', 'border-image-source', 'listStyle', 'list-style', 'listStyleImage', 'list-style-image'];

    cssProperties.forEach(function (prop) {
        var value = 'url(' + url + ')';

        // NOTE: If we setup `borderImage` or `border-image` property then it affects a `borderImageSource` property.
        var affectedProp = prop === 'borderImage' || prop === 'border-image' ? 'borderImageSource' : prop;

        //div.style[prop] = value;
        setNativeStyleProp(div, prop.replace(/[A-Z]/g, '-$&').toLowerCase(), value);

        //var nativeValue  = div.style[affectedProp];
        var nativeValue  = getNativeStylePropValue(div, affectedProp.replace(/[A-Z]/g, '-$&').toLowerCase());
        var proxiedValue = nativeValue && nativeValue.replace(url, proxyUrl);

        div.style[prop] = value;

        //strictEqual(getProperty(div.style, affectedProp), nativeValue, prop);
        //strictEqual(div.style[affectedProp], proxiedValue, prop);

        strictEqual(div.style[affectedProp], nativeValue, prop);
        strictEqual(getNativeStylePropValue(div, affectedProp.replace(/[A-Z]/g, '-$&').toLowerCase()), proxiedValue, prop);
    });
});

test('getPropertyValue and setProperty methods of css object should be overridden (GH-1212)', function () {
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
