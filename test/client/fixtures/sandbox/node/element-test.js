var urlUtils      = hammerhead.get('./utils/url');
var nativeMethods = hammerhead.nativeMethods;

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
// add tests for non-string values
test('HTMLElement.style', function () {
    var div = document.createElement('div');
    var url = '/image.jpg';

    div.style = 'background-image:url("' + url + '")';

    var actualBackgroundImageValue   = removeDoubleQuotes(nativeMethods.styleGetPropertyValue.call(div.style, 'background-image'));
    var expectedBackgroundImageValue = nativeMethods.htmlElementStyleSetter
        ? removeDoubleQuotes('url("' + urlUtils.getProxyUrl(url) + '")')
        : '';

    strictEqual(actualBackgroundImageValue, expectedBackgroundImageValue);
    //
    // div.style = {
    //     toString: function () {
    //         return 'background-image:url("' + url + '")';
    //     }
    // };
});

test('cssText', function () {
    var div      = document.createElement('div');
    var url      = '/image.png';
    var proxyUrl = urlUtils.getProxyUrl(url);

    div.style.cssText = 'background-image:url("' + url + '")';

    var actualBackgroundImageValue   = removeDoubleQuotes(nativeMethods.styleGetPropertyValue.call(div.style, 'background-image'));
    var expectedBackgroundImageValue = removeDoubleQuotes('url("' + proxyUrl + '")');

    strictEqual(actualBackgroundImageValue, expectedBackgroundImageValue);
    strictEqual(div.style.cssText.indexOf(proxyUrl), -1);
});

test('url in stylesheet properties', function () {
    var el            = document.createElement('div');
    var url           = 'http://some.domain.com/image.png';
    var proxyUrl      = urlUtils.getProxyUrl(url);
    var cssProperties = ['background', 'backgroundImage', 'background-image', 'borderImage', 'border-image', 'cursor',
        'borderImageSource', 'border-image-source', 'listStyle', 'list-style', 'listStyleImage', 'list-style-image'];

    cssProperties.forEach(function (prop) {
        var value = 'url(' + url + ')';

        // NOTE: If we setup `borderImage` or `border-image` property then it affects a `borderImageSource` property.
        var affectedProp = prop === 'borderImage' || prop === 'border-image' ? 'borderImageSource' : prop;

        //el.style[prop] = value;
        nativeMethods.styleSetProperty.call(el.style, prop.replace(/[A-Z]/g, '-$&').toLowerCase(), value);

        //var nativeValue  = el.style[affectedProp];
        var nativeValue  = nativeMethods.styleGetPropertyValue.call(el.style, affectedProp.replace(/[A-Z]/g, '-$&').toLowerCase());
        var proxiedValue = nativeValue && nativeValue.replace(url, proxyUrl);

        el.style[prop] = value;

        //strictEqual(getProperty(el.style, affectedProp), nativeValue, prop);
        //strictEqual(el.style[affectedProp], proxiedValue, prop);

        strictEqual(el.style[affectedProp], nativeValue, prop);
        strictEqual(nativeMethods.styleGetPropertyValue.call(el.style, affectedProp.replace(/[A-Z]/g, '-$&').toLowerCase()), proxiedValue, prop);
    });
});

test('getPropertyValue and setProperty methods of css object should be overridden (GH-1212)', function () {
    var div      = document.createElement('div');
    var url      = 'http://some.domain.com/image.png';
    var proxyUrl = urlUtils.getProxyUrl(url);

    div.style.setProperty('background', 'url(' + url + ')', '');

    ok(nativeMethods.styleGetPropertyValue.call(div.style, 'background').indexOf(proxyUrl) !== -1);
    ok(div.style.getPropertyValue('background').indexOf(proxyUrl) === -1);
    ok(div.style.getPropertyValue('background').indexOf(url) !== -1);

    var oldValue = div.style.removeProperty('background');

    ok(oldValue.indexOf(proxyUrl) === -1);

    div.style.setProperty('background', null);

    ok(!div.style.background);
    ok(!div.style.getPropertyValue('background'));
    ok(!div.style.removeProperty('background'));
});
