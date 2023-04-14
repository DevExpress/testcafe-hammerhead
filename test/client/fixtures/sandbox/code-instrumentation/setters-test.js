var urlUtils          = hammerhead.utils.url;
var processScript     = hammerhead.utils.processing.script.processScript;

var Promise               = hammerhead.Promise;
var nativeMethods         = hammerhead.nativeMethods;
var browserUtils          = hammerhead.utils.browser;
var elementEditingWatcher = hammerhead.sandbox.event.elementEditingWatcher;
var eventSimulator        = hammerhead.sandbox.event.eventSimulator;

test('unsupported protocol', function () {
    var img = document.createElement('img');

    img.src = 'about:blank';

    strictEqual(img.src, 'about:blank');
    strictEqual(nativeMethods.imageSrcGetter.call(img), 'about:blank');
});

test('anchor', function () {
    var anchor                               = document.createElement('a');
    var emptyAnchor                          = document.createElement('a');
    var anchorWithNotSupportedProtocol       = document.createElement('a');
    var etalonAnchor                         = document.createElement('a');
    var etalonEmptyAnchor                    = document.createElement('a');
    var etalonAnchorWithNotSupportedProtocol = document.createElement('a');
    var url                                  = 'https://google.com:1888/index.html?value#yo';
    var proxyUrl                             = urlUtils.getProxyUrl(url);

    nativeMethods.anchorHrefSetter.call(etalonAnchor, url);
    nativeMethods.anchorHrefSetter.call(anchor, proxyUrl);

    strictEqual(anchor.port, nativeMethods.anchorPortGetter.call(etalonAnchor), 'Anchor - port');
    strictEqual(anchor.host, nativeMethods.anchorHostGetter.call(etalonAnchor), 'Anchor - host');
    strictEqual(anchor.hostname, nativeMethods.anchorHostnameGetter.call(etalonAnchor), 'Anchor - hostname');
    strictEqual(anchor.protocol, nativeMethods.anchorProtocolGetter.call(etalonAnchor), 'Anchor - protocol');
    strictEqual(anchor.pathname, nativeMethods.anchorPathnameGetter.call(etalonAnchor), 'Anchor - pathname');
    strictEqual(anchor.search, nativeMethods.anchorSearchGetter.call(etalonAnchor), 'Anchor - search');
    strictEqual(anchor.hash, etalonAnchor.hash, 'Anchor - hash');

    if (nativeMethods.anchorOriginGetter)
        strictEqual(anchor.origin, nativeMethods.anchorOriginGetter.call(etalonAnchor));

    strictEqual(emptyAnchor.port, nativeMethods.anchorPortGetter.call(etalonEmptyAnchor));
    strictEqual(emptyAnchor.host, nativeMethods.anchorHostGetter.call(etalonEmptyAnchor));
    strictEqual(emptyAnchor.hostname, nativeMethods.anchorHostnameGetter.call(etalonEmptyAnchor));
    strictEqual(emptyAnchor.protocol, nativeMethods.anchorProtocolGetter.call(etalonEmptyAnchor));
    strictEqual(emptyAnchor.pathname, nativeMethods.anchorPathnameGetter.call(etalonEmptyAnchor));
    strictEqual(emptyAnchor.search, nativeMethods.anchorSearchGetter.call(etalonEmptyAnchor));

    if (nativeMethods.anchorOriginGetter)
        strictEqual(emptyAnchor.origin, nativeMethods.anchorOriginGetter.call(etalonEmptyAnchor));

    // Port
    anchor.port = '8080';
    nativeMethods.anchorPortSetter.call(etalonAnchor, '8080');
    strictEqual(anchor.port, nativeMethods.anchorPortGetter.call(etalonAnchor));

    emptyAnchor.port = '8080';
    nativeMethods.anchorPortSetter.call(etalonEmptyAnchor, '8080');
    strictEqual(emptyAnchor.port, nativeMethods.anchorPortGetter.call(etalonEmptyAnchor));
    nativeMethods.removeAttribute.call(etalonEmptyAnchor, 'href');

    // Host
    anchor.host = 'yandex.com:1234';
    nativeMethods.anchorHostSetter.call(etalonAnchor, 'yandex.com:1234');
    strictEqual(anchor.host, nativeMethods.anchorHostGetter.call(etalonAnchor));

    emptyAnchor.host = 'yandex.com:1234';
    nativeMethods.anchorHostSetter.call(etalonEmptyAnchor, 'yandex.com:1234');
    strictEqual(emptyAnchor.host, nativeMethods.anchorHostGetter.call(etalonEmptyAnchor));
    nativeMethods.removeAttribute.call(etalonEmptyAnchor, 'href');

    // Hostname
    anchor.hostname = 'yandex.ru';
    nativeMethods.anchorHostnameSetter.call(etalonAnchor, 'yandex.ru');
    strictEqual(anchor.hostname, nativeMethods.anchorHostnameGetter.call(etalonAnchor));

    emptyAnchor.hostname = 'yandex.ru';
    nativeMethods.anchorHostnameSetter.call(etalonEmptyAnchor, 'yandex.ru');
    strictEqual(emptyAnchor.hostname, nativeMethods.anchorHostnameGetter.call(etalonEmptyAnchor));
    nativeMethods.removeAttribute.call(etalonEmptyAnchor, 'href');

    // Protocol
    anchor.protocol = 'http:';
    nativeMethods.anchorProtocolSetter.call(etalonAnchor, 'http:');
    strictEqual(anchor.protocol, nativeMethods.anchorProtocolGetter.call(etalonAnchor));
    nativeMethods.removeAttribute.call(etalonEmptyAnchor, 'href');

    if (!browserUtils.isSafari) {
        emptyAnchor.protocol = 'https:';
        nativeMethods.anchorProtocolSetter.call(etalonEmptyAnchor, 'https:');
        strictEqual(emptyAnchor.protocol, nativeMethods.anchorProtocolGetter.call(etalonEmptyAnchor));
        nativeMethods.removeAttribute.call(etalonEmptyAnchor, 'href');
    }

    // Pathname
    var newPathName = nativeMethods.anchorPathnameGetter.call(etalonAnchor) + '/index.php';

    anchor.pathname = newPathName;
    nativeMethods.anchorPathnameSetter.call(etalonAnchor, newPathName);
    strictEqual(anchor.pathname, nativeMethods.anchorPathnameGetter.call(etalonAnchor));

    emptyAnchor.pathname = 'temp/index.php'; // TODO: iOS!!!
    nativeMethods.anchorPathnameSetter.call(etalonEmptyAnchor, 'temp/index.php');
    strictEqual(emptyAnchor.pathname, nativeMethods.anchorPathnameGetter.call(etalonEmptyAnchor));
    nativeMethods.removeAttribute.call(etalonEmptyAnchor, 'href');

    // Search
    anchor.search = '?test=temp';
    nativeMethods.anchorSearchSetter.call(etalonAnchor, '?test=temp');
    strictEqual(anchor.search, nativeMethods.anchorSearchGetter.call(etalonAnchor));

    emptyAnchor.search = '?test=temp';
    nativeMethods.anchorSearchSetter.call(etalonEmptyAnchor, '?test=temp');
    strictEqual(emptyAnchor.search, nativeMethods.anchorSearchGetter.call(etalonEmptyAnchor));
    nativeMethods.removeAttribute.call(etalonEmptyAnchor, 'href');


    nativeMethods.anchorHrefSetter.call(anchorWithNotSupportedProtocol, 'javascript:;');
    nativeMethods.anchorHrefSetter.call(etalonAnchorWithNotSupportedProtocol, 'javascript:;');

    strictEqual(anchorWithNotSupportedProtocol.port, nativeMethods.anchorPortGetter.call(etalonAnchorWithNotSupportedProtocol));
    strictEqual(anchorWithNotSupportedProtocol.host, nativeMethods.anchorHostGetter.call(etalonAnchorWithNotSupportedProtocol));
    strictEqual(anchorWithNotSupportedProtocol.hostname, nativeMethods.anchorHostnameGetter.call(etalonAnchorWithNotSupportedProtocol));
    strictEqual(anchorWithNotSupportedProtocol.protocol, nativeMethods.anchorProtocolGetter.call(etalonAnchorWithNotSupportedProtocol));
    strictEqual(anchorWithNotSupportedProtocol.pathname, nativeMethods.anchorPathnameGetter.call(etalonAnchorWithNotSupportedProtocol));
    strictEqual(anchorWithNotSupportedProtocol.search, nativeMethods.anchorSearchGetter.call(etalonAnchorWithNotSupportedProtocol));

    if (nativeMethods.anchorOriginGetter)
        strictEqual(anchorWithNotSupportedProtocol.origin, nativeMethods.anchorOriginGetter.call(etalonAnchorWithNotSupportedProtocol));
});

test('location as a local var', function () {
    var location = '';

    eval(processScript('location = "test"'));
    strictEqual(location, 'test');

    eval(processScript('location = null'));
    strictEqual(location, null);

    eval(processScript('location = undefined'));
    strictEqual(location, void 0);

    eval(processScript('location = ""'));
    strictEqual(location, '');
});

test('simple type', function () {
    strictEqual(setProperty(1, 'prop_name', 2), 2);
});


asyncTest('postMessage', function () {
    var target = window.location.protocol + '//' + window.location.host;

    createTestIframe({ src: window.location.origin })
        .then(function (iframe) {
            iframe.contentWindow.postMessage = function () {
                strictEqual(target, window.location.origin);
                start();
            };
            eval(processScript('iframe.contentWindow.postMessage("data", "' + target + '")'));
        });
});

module('regression');

asyncTest('valid resource type for iframe.contentWindow.location must be calculated', function () {
    var iframe  = document.createElement('iframe');
    var handler = function () {
        iframe.removeEventListener('load', handler);
        iframe.addEventListener('load', function () {
            strictEqual(urlUtils.parseProxyUrl(iframe.contentWindow.location).resourceType, 'i');
            iframe.parentNode.removeChild(iframe);
            start();
        });

        eval(processScript('iframe.contentWindow.location = "/test.html";'));
    };

    iframe.id = 'testT260697';
    iframe.addEventListener('load', handler);
    document.body.appendChild(iframe);
});

test('setting the link.href attribute to "mailto" in iframe (T228218)', function () {
    var storedGetProxyUrl = urlUtils.getProxyUrl;
    var anchror           = document.createElement('a');

    urlUtils.overrideGetProxyUrl(function () {
        return 'http://replaced';
    });

    anchror.href = 'http://host.com/';

    ok(nativeMethods.anchorHrefGetter.call(anchror).indexOf('http://replaced') === 0);

    anchror.href = 'mailto:test@mail.com';

    strictEqual(nativeMethods.anchorHrefGetter.call(anchror), 'mailto:test@mail.com');
    strictEqual(anchror.href, 'mailto:test@mail.com');
    strictEqual(anchror.getAttribute('href'), 'mailto:test@mail.com');

    urlUtils.overrideGetProxyUrl(storedGetProxyUrl);
});

test('link without the href attrubute must return an empty value for href (B238838)', function () {
    var url             = 'http://www.test.com/';
    var linkWithHref    = document.createElement('a');
    var linkWithoutHref = document.createElement('a');

    linkWithHref.href = url;

    strictEqual(linkWithHref.href, url);
    strictEqual(linkWithoutHref.href, '');
});

test('input\'s onchange event must not be raise after press Tab key (T221375)', function () {
    var $input     = $('<input value="0">');
    var firedCount = 0;

    $input.on('change', function () {
        firedCount++;
    });

    expect(1);

    function nextTick () {
        return new Promise(function (resolve) {
            setTimeout(resolve, 0);
        });
    }

    elementEditingWatcher.watchElementEditing($input[0]);

    nativeMethods.inputValueSetter.call($input[0], '123');
    eventSimulator.blur($input[0]);

    return nextTick()
        .then(function () {
            elementEditingWatcher.watchElementEditing($input[0]);

            nativeMethods.inputValueSetter.call($input[0], '423');

            $input[0].value = 42;

            eventSimulator.blur($input[0]);
        })
        .then(nextTick)
        .then(function () {
            strictEqual(firedCount, 1);
            $input.remove();
        });
});

test('restoring the removed RegExp.prototype.test function should not throw an error (GH-331)', function () {
    var savedTest = RegExp.prototype.test;
    var withError = false;

    try {
        delete RegExp.prototype.test;
        setProperty(RegExp.prototype, 'test', savedTest);
    }
    catch (e) {
        withError = true;
        // eslint-disable-next-line no-extend-native
        RegExp.prototype.test = savedTest;
    }

    ok(!withError);
});

test('the client code gets access to the Hammerhead script (GH-479)', function () {
    var div = document.createElement('div');

    div.innerHTML = '<html><body><div id="test"></div></body></html>';

    strictEqual(div.childNodes.length, 1);
    strictEqual(div.childNodes[0].id, 'test');
});

test("location assignment doesn't work (GH-640)", function () {
    var iframeSrc    = getSameDomainPageUrl('../../../data/code-instrumentation/iframe.html');
    var iframeNewSrc = getSameDomainPageUrl('../../../data/active-window-tracker/active-window-tracker.html');

    return createTestIframe({ src: iframeSrc })
        .then(function (iframe) {
            return new Promise(function (resolve) {
                iframe.addEventListener('load', function () {
                    resolve(iframe);
                });

                var changeLocationScript = 'location = "' + iframeNewSrc + '";';

                iframe.contentWindow.eval.call(iframe.contentWindow, processScript(changeLocationScript));
            });
        })
        .then(function (iframe) {
            var parsedProxyUrl = urlUtils.parseProxyUrl(iframe.contentWindow.location);

            strictEqual(parsedProxyUrl.resourceType, 'i');
            strictEqual(parsedProxyUrl.destResourceInfo.partAfterHost, urlUtils.parseUrl(iframeNewSrc).partAfterHost);
        });
});

test('should not throw an error on setting the body.innerHtml when document.body equals null (GH-1172)', function () {
    var iframe = document.createElement('iframe');

    iframe.id = 'test' + Date.now();

    document.body.appendChild(iframe);

    iframe.contentDocument.write(
        '<head>',
        '    <script>',
        '        var body = document.implementation.createHTMLDocument("").body;',
        '        try {',
        '            body.innerHTML = "<form></form>";',
        '            window.hasError = false;',
        '        } catch (e) {',
        '            window.hasError = true;',
        '        }',
        '    <' + '/script>',
        '</head>' // eslint-disable-line comma-dangle
    );

    ok(!iframe.contentWindow.hasError);

    document.body.removeChild(iframe);
});

if (!browserUtils.isFirefox) {
    test('set search property to anchor with unsupported protocol (GH-1276)', function () {
        var anchor = document.createElement('a');

        anchor.setAttribute('href', 'unsupported://some.link.com/path?x=10&y=20');

        anchor.search = '?z=30';

        strictEqual(nativeMethods.anchorHrefGetter.call(anchor), 'unsupported://some.link.com/path?z=30');
    });
}
