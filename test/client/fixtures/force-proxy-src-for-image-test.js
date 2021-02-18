var nativeMethods = hammerhead.nativeMethods;
var listeners     = hammerhead.sandbox.event.listeners;

var urlUtils = hammerhead.utils.url;

QUnit.testStart(function () {
    var domProcessor = hammerhead.processors.domProcessor;
    var settings     = hammerhead.settings;

    domProcessor.forceProxySrcForImage   = true;
    settings.get().forceProxySrcForImage = true;
});

test('setAttribute', function () {
    var image = document.createElement('img');

    image.setAttribute('src', '/test');
    strictEqual(nativeMethods.getAttribute.call(image, 'src'), urlUtils.getProxyUrl('/test'));
});

test('innerHTML', function () {
    var div = document.createElement('div');

    div.innerHTML = '<img src="/test">';
    strictEqual(nativeMethods.getAttribute.call(div.children[0], 'src'), urlUtils.getProxyUrl('/test'));
});

asyncTest('`load` handler', function () {
    var image                = document.createElement('img');
    var imgUrl               = window.QUnitGlobals.getResourceUrl('../data/node-sandbox/image.png');
    var raisedLoadEventCount = 0;

    document.body.appendChild(image);
    listeners.initElementListening(image, ['load']);

    image.addEventListener('error', function () {
        ok(false, 'image should not raise an error.');
    });
    image.addEventListener('load', function () {
        raisedLoadEventCount++;
    });
    image.setAttribute('src', imgUrl);
    strictEqual(nativeMethods.imageSrcGetter.call(image), urlUtils.getProxyUrl(imgUrl));

    window.setTimeout(function () {
        strictEqual(raisedLoadEventCount, 1);

        image.parentNode.removeChild(image);
        start();
    }, 1000);
});

