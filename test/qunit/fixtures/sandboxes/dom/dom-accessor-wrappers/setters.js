var Browser               = Hammerhead.get('./util/browser');
var DomProcessor          = Hammerhead.get('./dom-processor/dom-processor');
var ScriptProcessor       = Hammerhead.get('../processing/script');
var ElementEditingWatcher = Hammerhead.get('./sandboxes/event/element-editing-watcher');
var EventSimulator        = Hammerhead.get('./sandboxes/event/simulator');
var IFrameSandbox         = Hammerhead.get('./sandboxes/iframe');
var JSProcessor           = Hammerhead.get('../processing/js/index');
var NativeMethods         = Hammerhead.get('./sandboxes/native-methods');
var Const                 = Hammerhead.get('../const');
var UrlUtil               = Hammerhead.get('./util/url');

QUnit.testStart = function () {
    IFrameSandbox.on(IFrameSandbox.IFRAME_READY_TO_INIT, initIFrameTestHandler);
    IFrameSandbox.off(IFrameSandbox.IFRAME_READY_TO_INIT, IFrameSandbox.iframeReadyToInitHandler);
};

QUnit.testDone = function () {
    IFrameSandbox.off(IFrameSandbox.IFRAME_READY_TO_INIT, initIFrameTestHandler);
};

/* eslint-disable no-implied-eval */
test('script.textContent', function () {
    var script     = document.createElement('script');
    var scriptCode = 'var test = window.href;';

    eval(processScript('script.textContent="' + scriptCode + '"'));

    notEqual(script.textContent, scriptCode);
    strictEqual(script.textContent.replace(/\s/g, ''), ScriptProcessor.process(scriptCode).replace(/\s/g, ''));
});

//B237015 - Some tests fail in IE9 with unexpected alert message
test('innerHtml + script', function () {
    var testPropertyName = 'testProperty';
    var el               = document.createElement('div');
    var body             = document.getElementsByTagName('body')[0];
    var script           = '<script>window.' + testPropertyName + ' = true;\<\/script>';

    body.appendChild(el);
    el.innerHTML         = script;

    ok(!window[testPropertyName]);
});

test('unsupported protocol', function () {
    var img = document.createElement('img');

    eval(processScript('img.src = "about:blank";'));
    strictEqual(getProperty(img, 'src'), 'about:blank');
    strictEqual(img.src, 'about:blank');
});

test('anchor', function () {
    var anchor = document.createElement('a');
    /* eslint-disable no-unused-vars */
    var emptyAnchor = document.createElement('a');
    /* eslint-enable no-unused-vars */
    var anchorWithNotSupportedProtocol       = document.createElement('a');
    var etalonAnchor                         = document.createElement('a');
    var etalonEmptyAnchor                    = document.createElement('a');
    var etalonAnchorWithNotSupportedProtocol = document.createElement('a');
    var url                                  = 'https://google.com:1888/index.html?value#yo';
    var proxyUrl                             = UrlUtil.getProxyUrl(url);

    etalonAnchor.href = url;
    anchor.href       = proxyUrl;

    var execScript    = function (script) {
        return eval(processScript(script));
    };

    strictEqual(execScript('anchor.port'), etalonAnchor.port, 'Anchor - port');
    strictEqual(execScript('anchor.host'), etalonAnchor.host, 'Anchor - host');
    strictEqual(execScript('anchor.hostname'), etalonAnchor.hostname, 'Anchor - hostname');
    strictEqual(execScript('anchor.protocol'), etalonAnchor.protocol, 'Anchor - protocol');
    strictEqual(execScript('anchor.pathname'), etalonAnchor.pathname, 'Anchor - pathname');
    strictEqual(execScript('anchor.search'), etalonAnchor.search, 'Anchor - search');
    strictEqual(execScript('anchor.hash'), etalonAnchor.hash, 'Anchor - hash');


    if ('origin' in anchor)
        strictEqual(execScript('anchor.origin'), etalonAnchor.origin);

    strictEqual(execScript('emptyAnchor.port'), etalonEmptyAnchor.port);
    strictEqual(execScript('emptyAnchor.host'), etalonEmptyAnchor.host);
    strictEqual(execScript('emptyAnchor.hostname'), etalonEmptyAnchor.hostname);
    strictEqual(execScript('emptyAnchor.protocol'), etalonEmptyAnchor.protocol);
    strictEqual(execScript('emptyAnchor.pathname'), etalonEmptyAnchor.pathname);
    strictEqual(execScript('emptyAnchor.search'), etalonEmptyAnchor.search);

    if ('origin' in etalonEmptyAnchor)
        strictEqual(execScript('emptyAnchor.origin'), etalonEmptyAnchor.origin);

    // Port
    execScript('anchor.port="8080";');
    etalonAnchor.port = '8080';
    strictEqual(execScript('anchor.port'), etalonAnchor.port);

    etalonEmptyAnchor.port     = '8080';
    execScript('emptyAnchor.port="8080";');
    strictEqual(execScript('emptyAnchor.port'), etalonEmptyAnchor.port);

    // Host
    execScript('anchor.host="yandex.com";');
    etalonAnchor.host          = 'yandex.com';
    strictEqual(execScript('anchor.host'), etalonAnchor.host);

    execScript('emptyAnchor.host="yandex.com";');
    etalonEmptyAnchor.host     = 'yandex.com';
    strictEqual(execScript('emptyAnchor.host'), etalonEmptyAnchor.host);

    // Hostname
    execScript('anchor.hostname="yandex.ru";');
    etalonAnchor.hostname      = 'yandex.ru';
    strictEqual(execScript('anchor.hostname'), etalonAnchor.hostname);

    execScript('emptyAnchor.hostname="yandex.ru";');
    etalonEmptyAnchor.hostname = 'yandex.ru';
    strictEqual(execScript('emptyAnchor.hostname'), etalonEmptyAnchor.hostname);

    // Protocol
    execScript('anchor.protocol="http:";');
    etalonAnchor.protocol      = 'http:';
    strictEqual(execScript('anchor.protocol'), etalonAnchor.protocol);


    if (!Browser.isIOS) {
        execScript('emptyAnchor.protocol="https:";');
        etalonEmptyAnchor.protocol = 'https:';
        strictEqual(execScript('emptyAnchor.protocol'), etalonEmptyAnchor.protocol);
    }

    // Pathname
    var newPathName       = etalonAnchor.pathname + '/index.php';

    execScript('anchor.pathname="' + newPathName + '"');
    etalonAnchor.pathname = newPathName;
    strictEqual(execScript('anchor.pathname'), etalonAnchor.pathname);

    execScript('emptyAnchor.pathname="temp/index.php";'); // TODO: iOS!!!
    etalonEmptyAnchor.pathname = 'temp/index.php';
    strictEqual(execScript('emptyAnchor.pathname'), etalonEmptyAnchor.pathname);

    // Origin
    // IE has no origin property
    if ('origin' in etalonEmptyAnchor) {
        execScript('anchor.origin="http://yandex.ru:1335"');
        etalonAnchor.origin = 'http://yandex.ru:1335';
        strictEqual(execScript('anchor.origin'), etalonAnchor.origin);

        execScript('emptyAnchor.origin="http://yandex.ru:1335";'); // TODO: iOS!!!
        etalonEmptyAnchor.origin = 'http://yandex.ru:1335';
        strictEqual(execScript('emptyAnchor.origin'), etalonEmptyAnchor.origin);
    }

    // Search
    execScript('anchor.search="?test=temp"');
    etalonAnchor.search        = '?test=temp';
    strictEqual(execScript('anchor.search'), etalonAnchor.search);

    execScript('emptyAnchor.search="?test=temp"'); // TODO: iOS!!!
    etalonEmptyAnchor.search = '?test=temp';
    strictEqual(execScript('emptyAnchor.search'), etalonEmptyAnchor.search);

    anchorWithNotSupportedProtocol.href       = 'javascript:;';
    etalonAnchorWithNotSupportedProtocol.href = 'javascript:;';

    strictEqual(execScript('anchorWithNotSupportedProtocol.port'), etalonAnchorWithNotSupportedProtocol.port);
    strictEqual(execScript('anchorWithNotSupportedProtocol.host'), etalonAnchorWithNotSupportedProtocol.host);
    strictEqual(execScript('anchorWithNotSupportedProtocol.hostname'), etalonAnchorWithNotSupportedProtocol.hostname);
    strictEqual(execScript('anchorWithNotSupportedProtocol.protocol'), etalonAnchorWithNotSupportedProtocol.protocol);
    strictEqual(execScript('anchorWithNotSupportedProtocol.pathname'), etalonAnchorWithNotSupportedProtocol.pathname);
    strictEqual(execScript('anchorWithNotSupportedProtocol.search'), etalonAnchorWithNotSupportedProtocol.search);

    if ('origin' in anchorWithNotSupportedProtocol)
        strictEqual(execScript('anchorWithNotSupportedProtocol.origin'), etalonAnchorWithNotSupportedProtocol.origin);
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

if (!Browser.isIE) {
    //T260697 - TestCafe does not record actions in the mobile simulator
    asyncTest('iframe.contentWindow.location', function () {
        var iframe = document.createElement('iframe');

        iframe.id = 'testT260697';

        var loadHandler = function () {
            iframe.removeEventListener('load', loadHandler);

            iframe.addEventListener('load', function () {
                strictEqual(UrlUtil.parseProxyUrl(iframe.contentWindow.location).resourceType, 'iframe');
                iframe.parentNode.removeChild(iframe);
                start();
            });

            eval(processScript('iframe.contentWindow.location = "/test.html";'));
        };

        iframe.addEventListener('load', loadHandler);
        document.body.appendChild(iframe);
    });
}

test('simple type', function () {
    strictEqual(setProperty(1, 'prop_name', 2), 2);
});

test('script text', function () {
    var script = document.createElement('script');

    eval(processScript('script.text="var test = window.href;"'));
    ok(JSProcessor.isScriptProcessed(script.text));
});

test('iframe', function () {
    var iframe = document.createElement('iframe');

    window[Const.DOM_SANDBOX_OVERRIDE_DOM_METHOD_NAME](iframe);

    eval(processScript('iframe.sandbox="allow-forms"'));
    strictEqual(NativeMethods.getAttribute.call(iframe, 'sandbox'), 'allow-forms allow-scripts');
    strictEqual(NativeMethods.getAttribute.call(iframe, DomProcessor.getStoredAttrName('sandbox')), 'allow-forms');

    var result = '';

    eval(processScript('result = iframe.sandbox'));
    strictEqual(result, 'allow-forms');
});

asyncTest('body.innerHTML in iframe', function () {
    expect(2);

    $('<iframe src="/data/dom-accessor-wrappers/iframe.html">').appendTo(document.body).load(function () {
        var iframe         = this;
        var iframeDocument = iframe.contentWindow.document;

        ok(NativeMethods.querySelector.call(iframeDocument, 'body [id^="root"]') !== null);

        eval(processScript('iframeDocument.body.innerHTML = "";'));

        window.setTimeout(function () {
            ok(NativeMethods.querySelector.call(iframeDocument, 'body [id^="root"]') !== null);
            iframe.parentNode.removeChild(iframe);
            start();
        }, 100);
    });
});

//Q527555 - Can not click on button in DIV
asyncTest('body.innerHtml in iframe (with a.href)', function () {
    var $iframe = $('<iframe id="test">').appendTo('body');

    window.setTimeout(function () {
        var iframeBody = $iframe[0].contentWindow.document.body;
        var html       = '<a href="url" ' + DomProcessor.getStoredAttrName('src') + '="url1" />';

        iframeBody.innerHTML = html;

        ok(getProperty(iframeBody, 'innerHTML') !== html);
        $iframe.remove();
        start();
    }, 100);
});

//T198784: Javascript error on the http://automated-testing.info/ page
test('object with properties equal "a" tag', function () {
    /* eslint-disable no-unused-vars */
    var obj = {
        target:  'ok',
        tagName: -1
    };

    strictEqual(eval(processScript('obj.target')), 'ok');
    /* eslint-enable no-unused-vars */
});

//T230802: TD15.1 - Page content is not loaded on the nest.com page after hammerhead processing
test('object with properties equal "input" tag', function () {
    /* eslint-disable no-unused-vars */
    var obj = {
        size:    null,
        tagName: 'input',
        type:    'text',
        value:   ''
    };

    strictEqual(eval(processScript('obj.value')), '');
    /* eslint-enable no-unused-vars */
});

//T228218: Page script can\'t set the href attribute with \'malito\' to an element in an iFrame
test('href attribute with \'malito\' value to an iframe element', function () {
    var storedGetProxyUrl = UrlUtil.getProxyUrl;
    var link              = document.createElement('a');

    UrlUtil.getProxyUrl = function () {
        return 'http://replaced';
    };

    eval(processScript('link.href="http://host.com/"'));
    ok(link.href.indexOf('http://replaced') === 0);

    eval(processScript('link.href="mailto:test@mail.com"'));
    strictEqual(link.href, 'mailto:test@mail.com');
    strictEqual(eval(processScript('link.href')), 'mailto:test@mail.com');
    strictEqual(link.getAttribute('href'), 'mailto:test@mail.com');

    UrlUtil.getProxyUrl = storedGetProxyUrl;
});

//B238838 - TestCafe cant switch ASPxPageControl tabs in AutoPostBack mode
test('a.href', function () {
    var url             = 'http://www.test.com/';
    var linkWithHref    = $('<a href="' + url + '">')[0];
    var linkWithoutHref = $('<a>')[0];

    strictEqual(getProperty(linkWithHref, 'href'), url);
    strictEqual(getProperty(linkWithoutHref, 'href'), '');
});

// IE does not allow to override postMessage method
if (!Browser.isIE) {
    asyncTest('postMessage', function () {
        var target = window.location.protocol + '//' + window.location.host;
        var iframe = document.createElement('iframe');

        iframe.src = window.location.origin;
        iframe.addEventListener('load', function () {
            iframe.contentWindow.postMessage = function () {
                strictEqual(target, window.location.origin);
                iframe.parentNode.removeChild(iframe);
                this.postMessage = function () {
                };
                start();
            };
            eval(processScript('iframe.contentWindow.postMessage("data", "' + target + '")'));
        });
        document.body.appendChild(iframe);
    });
}

//T232468: TD15.1 - Cannot record test for http://showcase.sproutcore.com/#demos/Transition%20Animation%20Plugins page
test('event.which', function () {
    /* eslint-disable no-unused-vars */
    var evtObj = {
        originalEvent: null
    };

    strictEqual(eval(processScript('evtObj.which')), void 0);
    /* eslint-enable no-unused-vars */
});

//T221375: Inconsistent behavior OnChange event in TestCafe and browsers(Chrome, IE)
asyncTest('input.value for special cases', function () {
    var $input     = $('<input value="0">');
    var firedCount = 0;

    $input.on('change', function () {
        firedCount++;
    });

    expect(2);

    async.series([
        function (callback) {
            ElementEditingWatcher.watchElementEditing($input[0]);

            $input[0].value = '123';
            EventSimulator.blur($input[0]);

            setTimeout(callback, 0);
        },
        function (callback) {
            ElementEditingWatcher.watchElementEditing($input[0]);

            $input[0].value = '423';
            eval(processScript('$input[0].value = 42'));
            EventSimulator.blur($input[0]);

            setTimeout(callback, 0);
        }
    ], function (error) {
        ok(!error);
        strictEqual(firedCount, 1);
        $input.remove();
        start();
    });
});
/* eslint-enable no-implied-eval */
