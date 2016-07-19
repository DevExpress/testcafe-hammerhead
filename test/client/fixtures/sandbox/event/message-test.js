var settings      = hammerhead.get('./settings');

var Promise        = hammerhead.Promise;
var browserUtils   = hammerhead.utils.browser;
var iframeSandbox  = hammerhead.sandbox.iframe;
var messageSandbox = hammerhead.sandbox.event.message;

QUnit.testStart(function () {
    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
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
    callMethod(window, 'postMessage', [testMessage, '*']);
});

asyncTest('onmessage event', function () {
    var iframe                = document.createElement('iframe');
    var src                   = window.getCrossDomainPageUrl('../../../data/cross-domain/get-message.html');
    var storedCrossDomainPort = settings.get().crossDomainProxyPort;
    var count                 = 0;

    iframe.id = 'test01';

    var onMessageHandler = function (evt) {
        var data = typeof evt.data === 'string' ? JSON.parse(evt.data) : evt.data;

        strictEqual(evt.origin, 'http://origin_iframe_host');
        strictEqual(data.msg, 'https://example.com');

        count++;

        if (count === 2) {
            settings.get().crossDomainProxyPort = storedCrossDomainPort;
            iframe.parentNode.removeChild(iframe);
            window.removeEventListener('message', onMessageHandler);
            start();
        }
    };

    settings.get().crossDomainProxyPort = 2001;

    iframe.setAttribute('src', src);
    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            setProperty(window, 'onmessage', onMessageHandler);
            window.addEventListener('message', onMessageHandler);
            callMethod(iframe.contentWindow, 'postMessage', ['', '*']);
        });
    document.body.appendChild(iframe);
});

asyncTest('cross-domain post messages between different windows', function () {
    expect(0);

    var iframe           = document.createElement('iframe');
    var result           = 0;
    var onMessageHandler = null;
    var checkResult      = function () {
        if (result === 4) {
            iframe.parentNode.removeChild(iframe);
            window.removeEventListener('message', onMessageHandler);
            start();
        }
    };

    iframe.id = 'test02';

    onMessageHandler = function (e) {
        if (parseInt(e.data, 10))
            result++;

        checkResult();
    };

    setProperty(window, 'onmessage', onMessageHandler);

    iframe.src = window.getCrossDomainPageUrl('../../../data/cross-domain/target-url.html');
    document.body.appendChild(iframe);
});

asyncTest('message types', function () {
    var checkValue = function (value, test) {
        return new Promise(function (resove) {
            var onMessageHandler = function (e) {
                if (test)
                    ok(test(e.data));
                else
                    strictEqual(e.data, value);

                resove();
            };

            setProperty(window, 'onmessage', onMessageHandler);
            callMethod(window, 'postMessage', [value, '*']);
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
    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            var sourceObj = { testObject: true };

            iframe.contentWindow['%hammerhead%'].sandbox.event.message.on(messageSandbox.SERVICE_MSG_RECEIVED_EVENT, function (e) {
                ok(e.message.testObject);
                e.message.modified = true;
                ok(!sourceObj.modified);
                iframe.parentNode.removeChild(iframe);

                start();
            });
            messageSandbox.sendServiceMsg(sourceObj, iframe.contentWindow);
        });
    document.body.appendChild(iframe);
});

asyncTest('crossdomain', function () {
    var iframe                = document.createElement('iframe');
    var storedCrossDomainPort = settings.get().crossDomainProxyPort;
    var serviceMsgReceived    = false;
    var serviceMsgHandler     = function () {
        serviceMsgReceived = true;
    };
    var isServiceMsgReceived  = function () {
        return serviceMsgReceived;
    };

    iframe.id = 'test03';

    settings.get().crossDomainProxyPort = 2001;

    iframe.src = window.getCrossDomainPageUrl('../../../data/cross-domain/service-message.html');
    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            messageSandbox.on(messageSandbox.SERVICE_MSG_RECEIVED_EVENT, serviceMsgHandler);
            messageSandbox.sendServiceMsg('service_msg', iframe.contentWindow);

            return window.QUnitGlobals.wait(isServiceMsgReceived);
        })
        .then(function () {
            ok(serviceMsgReceived);

            settings.get().crossDomainProxyPort = storedCrossDomainPort;
            iframe.parentNode.removeChild(iframe);
            messageSandbox.off(messageSandbox.SERVICE_MSG_RECEIVED_EVENT, serviceMsgHandler);
            start();
        });
    document.body.appendChild(iframe);
});

asyncTest('service message handler should not call other handlers', function () {
    var iframe                = document.createElement('iframe');
    var storedCrossDomainPort = settings.get().crossDomainProxyPort;
    var windowHandlerExecuted = false;
    var windowMessageHandler  = function () {
        windowHandlerExecuted = true;
    };
    var serviceMsgHandler     = function (evt) {
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

    iframe.id = 'test04';

    settings.get().crossDomainProxyPort = 2001;

    iframe.src = window.getCrossDomainPageUrl('../../../data/cross-domain/service-message-with-handlers.html');
    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            setProperty(window, 'onmessage', windowMessageHandler);
            window.addEventListener('message', windowMessageHandler);
            messageSandbox.on(messageSandbox.SERVICE_MSG_RECEIVED_EVENT, serviceMsgHandler);
            messageSandbox.sendServiceMsg('service_msg', iframe.contentWindow);
        });
    document.body.appendChild(iframe);
});

module('ping window');

asyncTest('iframe', function () {
    var iframe                 = document.createElement('iframe');
    var iframeResponseReceived = false;
    var onMessageHandler       = function (evt) {
        if (evt.data === 'ready') {
            ok(iframeResponseReceived);

            window.removeEventListener('message', onMessageHandler);
            iframe.parentNode.removeChild(iframe);
            start();
        }
    };

    iframe.id = 'test05';

    window.addEventListener('message', onMessageHandler);

    messageSandbox.pingIframe(iframe, 'pingCmd')
        .then(function () {
            iframeResponseReceived = true;
        });

    iframe.src = window.getCrossDomainPageUrl('../../../data/cross-domain/wait-loading.html');
    document.body.appendChild(iframe);
});

asyncTest('timeout (non-added to DOM iframe)', function () {
    var iframe      = document.createElement('iframe');
    var storedDelay = messageSandbox.PING_IFRAME_TIMEOUT;

    iframe.id = 'test06';

    messageSandbox.PING_IFRAME_TIMEOUT = 5;

    iframe.src = 'http://cross.domain.com/';

    messageSandbox.pingIframe(iframe, 'pingCmd')
        .then(function () {
            ok(false, 'ping should not be resolved');
        }, function () {
            ok(true, 'ping should be rejected');
        })
        .then(function () {
            messageSandbox.PING_IFRAME_TIMEOUT = storedDelay;
            start();
        });
});

asyncTest('timeout (added to DOM iframe)', function () {
    var iframe      = document.createElement('iframe');
    var storedDelay = messageSandbox.PING_IFRAME_TIMEOUT;

    iframe.id = 'test07';

    messageSandbox.PING_IFRAME_TIMEOUT = 5;

    iframe.src = 'http://cross.domain.com/';
    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            return messageSandbox.pingIframe(iframe, 'pingCmd');
        })
        .then(function () {
            ok(false, 'ping should not be resolved');
        }, function () {
            ok(true, 'ping should be rejected');
        })
        .then(function () {
            messageSandbox.PING_IFRAME_TIMEOUT = storedDelay;
            iframe.parentNode.removeChild(iframe);

            start();
        });
    document.body.appendChild(iframe);
});

module('regression');

asyncTest('service message from removed iframe (GH-64)', function () {
    var iframe            = document.createElement('iframe');
    var messageReceived   = false;
    var isMessageReceived = function () {
        return messageReceived;
    };

    iframe.id = 'test08';

    messageSandbox.on(messageSandbox.SERVICE_MSG_RECEIVED_EVENT, function () {
        messageReceived = true;
    });

    iframe.src = window.QUnitGlobals.getResourceUrl('../../../data/same-domain/service-message-from-removed-iframe.html');
    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            return window.QUnitGlobals.wait(isMessageReceived);
        })
        .then(function () {
            ok(messageReceived, 'message received');
            start();
        });
    document.body.appendChild(iframe);
});

asyncTest('should not raise an error for sendServiceMessage if window.top is a cross-domain window (GH-666)', function () {
    var iframe            = document.createElement('iframe');
    var messageData       = null;
    var isMessageReceived = function () {
        return !!messageData;
    };
    var onMessageHandler = function (e) {
        messageData = e.data;
    };

    window.addEventListener('message', onMessageHandler);

    iframe.src = window.getCrossDomainPageUrl('../../../data/event-sandbox/send-message-when-top-window-is-cross-domain.html');
    iframe.id  = 'test_unique_id_edzyxob6s';
    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            return window.QUnitGlobals.wait(isMessageReceived);
        })
        .then(function () {
            ok(!messageData.errorIsRaised);
            window.removeEventListener('message', onMessageHandler);
            iframe.parentNode.removeChild(iframe);
            start();
        });
    document.body.appendChild(iframe);
});
