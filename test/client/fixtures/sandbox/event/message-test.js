var processScript = hammerhead.get('../processing/script').processScript;
var settings        = hammerhead.get('./settings');

var Promise        = hammerhead.Promise;
var browserUtils   = hammerhead.utils.browser;
var iframeSandbox  = hammerhead.sandbox.iframe;
var messageSandbox = hammerhead.sandbox.event.message;

QUnit.testStart(function () {
    iframeSandbox.on(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, initIframeTestHandler);
});

asyncTest('onmessage event (handler has "object" type) (GH-133)', function () {
    var testMessage = 'test';

    var eventHandlerObject = {
        handleEvent: function (e) {
            strictEqual(e.data, testMessage);
            strictEqual(this, eventHandlerObject);
            window.removeEventListener('message', eventHandlerObject);
            start();
        }
    };

    window.addEventListener('message', eventHandlerObject);
    eval(processScript('window.postMessage(testMessage, "*");', true, false));
});

asyncTest('onmessage event', function () {
    var $iframe               = $('<iframe>');
    var storedCrossDomainPort = settings.get().crossDomainProxyPort;
    var count                 = 0;

    settings.get().crossDomainProxyPort = 2001;

    $iframe[0].src = window.getCrossDomainPageUrl('../../../data/cross-domain/get-message.html');
    $iframe.appendTo('body');

    var onMessageHandler = function (evt) {
        var data = typeof evt.data === 'string' ? JSON.parse(evt.data) : evt.data;

        strictEqual(evt.origin, 'http://origin_iframe_host');
        strictEqual(data.msg, 'https://example.com');

        count++;

        if (count === 2) {
            settings.get().crossDomainProxyPort = storedCrossDomainPort;
            $iframe.remove();
            window.removeEventListener('message', onMessageHandler);
            start();
        }
    };

    $iframe.bind('load', function () {
        eval(processScript('window.onmessage = onMessageHandler;', true, false));
        window.addEventListener('message', onMessageHandler);
        eval(processScript('this.contentWindow.postMessage(\'\', \'*\')', true, false));
    });
});

asyncTest('crossdomain post messages between diffferen windows', function () {
    expect(0);

    var iframe = document.createElement('iframe');

    iframe.src = window.getCrossDomainPageUrl('../../../data/cross-domain/target-url.html');
    document.body.appendChild(iframe);

    var result = 0;

    var checkResult = function () {
        if (result === 4) {
            iframe.parentNode.removeChild(iframe);
            window.removeEventListener('message', onMessageHandler);
            start();
        }
    };

    var onMessageHandler = function (e) {
        if (parseInt(e.data, 10))
            result++;

        checkResult();
    };

    eval(processScript('window.onmessage = onMessageHandler;', true, false));
});

asyncTest('message types', function () {
    var checkValue = function (value, test) {
        return new Promise(function (resove) {
            /* eslint-disable no-unused-vars*/
            var onMessageHandler = function (e) {
                if (test)
                    ok(test(e.data));
                else
                    strictEqual(e.data, value);

                resove();
            };

            /* eslint-enable no-unused-vars*/

            eval(processScript('window.onmessage = onMessageHandler;', true, false));
            eval(processScript('window.postMessage(value, "*");', true, false));
        });
    };

    if (browserUtils.isIE9)
        checkValue('test').then(start);
    else {
        checkValue(true)
            .then(function () {
                return checkValue(0);
            })
            .then(function () {
                return checkValue('');
            })
            .then(function () {
                return checkValue([0], function (a) {
                    return a.length === 1 && a[0] === 0;
                });
            })
            .then(function () {
                return checkValue({ a: 0 }, function (a) {
                    return a.a === 0;
                });
            })
            .then(function () {
                return checkValue(null);
            })
            .then(function () {
                return checkValue(void 0);
            })
            .then(function () {
                return checkValue('{a:0}');
            })
            .then(start);
    }
});

module('service messages');

asyncTest('cloning arguments', function () {
    var iframe = document.createElement('iframe');

    iframe.id = 'test006';
    iframe.addEventListener('load', function () {
        var sourceObj = { testObject: true };

        this.contentWindow['%hammerhead%'].sandbox.event.message.on(messageSandbox.SERVICE_MSG_RECEIVED_EVENT, function (e) {
            ok(e.message.testObject);
            e.message.modified = true;
            ok(!sourceObj.modified);
            iframe.parentNode.removeChild(iframe);

            start();
        });

        messageSandbox.sendServiceMsg(sourceObj, this.contentWindow);
    });

    document.body.appendChild(iframe);
});

asyncTest('crossdomain', function () {
    var iframe                = document.createElement('iframe');
    var storedCrossDomainPort = settings.get().crossDomainProxyPort;
    var serviceMsgReceived    = false;

    settings.get().crossDomainProxyPort = 2001;

    var serviceMsgHandler = function () {
        serviceMsgReceived = true;
    };

    iframe.src = window.getCrossDomainPageUrl('../../../data/cross-domain/service-message.html');
    iframe.addEventListener('load', function () {
        messageSandbox.on(messageSandbox.SERVICE_MSG_RECEIVED_EVENT, serviceMsgHandler);
        messageSandbox.sendServiceMsg('service_msg', this.contentWindow);

        window.setTimeout(function () {
            ok(serviceMsgReceived);

            settings.get().crossDomainProxyPort = storedCrossDomainPort;
            iframe.parentNode.removeChild(iframe);
            messageSandbox.off(messageSandbox.SERVICE_MSG_RECEIVED_EVENT, serviceMsgHandler);
            start();
        }, 200);
    });

    document.body.appendChild(iframe);
});

asyncTest('service message handler should not call other handlers', function () {
    var iframe                = document.createElement('iframe');
    var storedCrossDomainPort = settings.get().crossDomainProxyPort;
    var windowHandlerExecuted = false;

    settings.get().crossDomainProxyPort = 2001;

    var windowMessageHandler = function () {
        windowHandlerExecuted = true;
    };

    var serviceMsgHandler = function (evt) {
        window.setTimeout(function () {
            ok(!windowHandlerExecuted);
            strictEqual(evt.message, 'successfully');

            settings.get().crossDomainProxyPort = storedCrossDomainPort;
            iframe.parentNode.removeChild(iframe);

            window.removeEventListener('message', windowMessageHandler);
            messageSandbox.off(messageSandbox.SERVICE_MSG_RECEIVED_EVENT, serviceMsgHandler);

            start();
        }, 100);
    };

    iframe.src = window.getCrossDomainPageUrl('../../../data/cross-domain/service-message-with-handlers.html');
    iframe.addEventListener('load', function () {
        eval(processScript('window.onmessage = windowMessageHandler;', true, false));
        window.addEventListener('message', windowMessageHandler);
        messageSandbox.on(messageSandbox.SERVICE_MSG_RECEIVED_EVENT, serviceMsgHandler);
        messageSandbox.sendServiceMsg('service_msg', this.contentWindow);
    });
    document.body.appendChild(iframe);
});

module('ping window');

asyncTest('iframe', function () {
    var iframe                 = document.createElement('iframe');
    var iframeResponseReceived = false;

    var onMessageHandler = function (evt) {
        if (evt.data === 'ready') {
            ok(iframeResponseReceived);

            window.removeEventListener('message', onMessageHandler);
            iframe.parentNode.removeChild(iframe);
            start();
        }
    };

    window.addEventListener('message', onMessageHandler);

    messageSandbox.pingIframe(iframe, 'pingCmd')
        .then(function () {
            iframeResponseReceived = true;
        });

    iframe.src = window.getCrossDomainPageUrl('../../../data/cross-domain/wait-loading.html');
    document.body.appendChild(iframe);
});

asyncTest('timeout', function () {
    var iframe               = document.createElement('iframe');
    var timeoutExceededError = false;
    var storedDelay          = messageSandbox.PING_IFRAME_TIMEOUT;
    var timeout              = 100;

    messageSandbox.setPingIframeTimeout(5);

    iframe.src = 'http://cross.domain.com/';

    messageSandbox.pingIframe(iframe, 'pingCmd')
        .then(function (timeoutExceeded) {
            timeoutExceededError = timeoutExceeded;
        });

    window.setTimeout(function () {
        ok(timeoutExceededError);
        iframe.parentNode.removeChild(iframe);

        messageSandbox.PING_IFRAME_TIMEOUT = storedDelay;

        start();
    }, timeout);

    document.body.appendChild(iframe);
});

module('regression');

asyncTest('service message from removed iframe (GH-64)', function () {
    var iframe          = document.createElement('iframe');
    var messageReceived = false;

    iframe.src = window.QUnitGlobals.getResourceUrl('../../../data/same-domain/service-message-from-removed-iframe.html');

    iframe.addEventListener('load', function () {
        window.setTimeout(function () {
            ok(messageReceived, 'message received');

            start();
        }, 100);
    });

    document.body.appendChild(iframe);

    messageSandbox.on(messageSandbox.SERVICE_MSG_RECEIVED_EVENT, function () {
        messageReceived = true;
    });
});
