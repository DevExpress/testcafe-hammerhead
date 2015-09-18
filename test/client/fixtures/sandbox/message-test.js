var Browser         = Hammerhead.get('./utils/browser');
var ScriptProcessor = Hammerhead.get('../processing/script');
var Settings        = Hammerhead.get('./settings');

var iframeSandbox = Hammerhead.sandbox.iframe;
var messageSandbox = Hammerhead.sandbox.message;

QUnit.testStart(function () {
    iframeSandbox.on(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, initIFrameTestHandler);
    iframeSandbox.off(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, initIFrameTestHandler);
});

asyncTest('onmessage event', function () {
    var $iframe               = $('<iframe>');
    var storedCrossDomainPort = Settings.get().crossDomainProxyPort;
    var count                 = 0;

    Settings.get().crossDomainProxyPort = 2001;

    $iframe[0].src = window.getCrossDomainPageUrl('../../data/cross-domain/get-message.html');
    $iframe.appendTo('body');

    var onMessageHandler = function (evt) {
        var data = typeof evt.data === 'string' ? JSON.parse(evt.data) : evt.data;

        strictEqual(evt.origin, 'http://origin_iframe_host');
        strictEqual(data.msg, 'https://example.com');

        count++;

        if (count === 2) {
            Settings.get().crossDomainProxyPort = storedCrossDomainPort;
            $iframe.remove();
            window.removeEventListener('message', onMessageHandler);
            start();
        }
    };

    $iframe.bind('load', function () {
        eval(ScriptProcessor.process('window.onmessage = onMessageHandler;'));
        window.addEventListener('message', onMessageHandler);
        eval(ScriptProcessor.process('this.contentWindow.postMessage(\'\', \'*\')'));
    });
});

asyncTest('crossdomain post messages between diffferen windows', function () {
    expect(0);

    var iframe = document.createElement('iframe');

    iframe.src = window.getCrossDomainPageUrl('../../data/cross-domain/target-url.html');
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

    eval(ScriptProcessor.process('window.onmessage = onMessageHandler;'));
});

asyncTest('message types', function () {
    var checkValue = function (value, callback, test) {
        /* eslint-disable no-unused-vars*/
        var onMessageHandler = function (e) {
            if (test)
                ok(test(e.data));
            else
                strictEqual(e.data, value);

            callback();
        };

        /* eslint-enable no-unused-vars*/

        eval(ScriptProcessor.process('window.onmessage = onMessageHandler;'));
        eval(ScriptProcessor.process('window.postMessage(value, "*");'));
    };

    if (Browser.isIE9) {
        checkValue('test', function () {
            start();
        });
    }
    else {
        checkValue(true, function () {
            checkValue(0, function () {
                checkValue('', function () {
                    checkValue([0], function () {
                        checkValue({ a: 0 }, function () {
                            checkValue(null, function () {
                                checkValue(void 0, function () {
                                    checkValue('{a:0}', function () {
                                        start();
                                    });
                                });
                            });
                        }, function (a) {
                            return a.a === 0;
                        });
                    }, function (a) {
                        return a.length === 1 && a[0] === 0;
                    });
                });
            });
        });
    }
});

module('service messages');

asyncTest('cloning arguments', function () {
    var iframe = document.createElement('iframe');

    iframe.id = 'test006';
    iframe.addEventListener('load', function () {
        var sourceObj = { testObject: true };

        this.contentWindow.Hammerhead.MessageSandbox.on(messageSandbox.SERVICE_MSG_RECEIVED, function (e) {
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
    var storedCrossDomainPort = Settings.get().crossDomainProxyPort;
    var serviceMsgReceived    = false;

    Settings.get().crossDomainProxyPort = 2001;

    var serviceMsgHandler = function () {
        serviceMsgReceived = true;
    };

    iframe.src = window.getCrossDomainPageUrl('../../data/cross-domain/service-message.html');
    iframe.addEventListener('load', function () {
        messageSandbox.on(messageSandbox.SERVICE_MSG_RECEIVED, serviceMsgHandler);
        messageSandbox.sendServiceMsg('service_msg', this.contentWindow);

        window.setTimeout(function () {
            ok(serviceMsgReceived);

            Settings.get().crossDomainProxyPort = storedCrossDomainPort;
            iframe.parentNode.removeChild(iframe);
            messageSandbox.off(messageSandbox.SERVICE_MSG_RECEIVED, serviceMsgHandler);
            start();
        }, 200);
    });

    document.body.appendChild(iframe);
});

asyncTest('service message handler should not call other handlers', function () {
    var iframe                = document.createElement('iframe');
    var storedCrossDomainPort = Settings.get().crossDomainProxyPort;
    var windowHandlerExecuted = false;

    Settings.get().crossDomainProxyPort = 2001;

    var windowMessageHandler = function () {
        windowHandlerExecuted = true;
    };

    var serviceMsgHandler = function (evt) {
        window.setTimeout(function () {
            ok(!windowHandlerExecuted);
            strictEqual(evt.message, 'successfully');

            Settings.get().crossDomainProxyPort = storedCrossDomainPort;
            iframe.parentNode.removeChild(iframe);

            window.removeEventListener('message', windowMessageHandler);
            messageSandbox.off(messageSandbox.SERVICE_MSG_RECEIVED, serviceMsgHandler);

            start();
        }, 100);
    };

    iframe.src = window.getCrossDomainPageUrl('../../data/cross-domain/service-message-with-handlers.html');
    iframe.addEventListener('load', function () {
        eval(ScriptProcessor.process('window.onmessage = windowMessageHandler;'));
        window.addEventListener('message', windowMessageHandler);
        messageSandbox.on(messageSandbox.SERVICE_MSG_RECEIVED, serviceMsgHandler);
        messageSandbox.sendServiceMsg('service_msg', this.contentWindow);
    });
    document.body.appendChild(iframe);
});

module('ping window');

asyncTest('iframe', function () {
    var iframe                 = document.createElement('iframe');
    var iFrameResponseReceived = false;

    var onMessageHandler = function (evt) {
        if (evt.data === 'ready') {
            ok(iFrameResponseReceived);

            window.removeEventListener('message', onMessageHandler);
            iframe.parentNode.removeChild(iframe);
            start();
        }
    };

    window.addEventListener('message', onMessageHandler);

    messageSandbox.pingIFrame(iframe, 'pingCmd', function () {
        iFrameResponseReceived = true;
    });

    iframe.src = window.getCrossDomainPageUrl('../../data/cross-domain/wait-loading.html');
    document.body.appendChild(iframe);
});

asyncTest('timeout', function () {
    var iframe               = document.createElement('iframe');
    var timeoutExceededError = false;
    var storedDelay          = messageSandbox.PING_IFRAME_TIMEOUT;

    messageSandbox.setPingIFrameTimeout(5);

    iframe.src = 'http://cross.domain.com/';

    messageSandbox.pingIFrame(iframe, 'pingCmd', function (timeoutExceeded) {
        timeoutExceededError = timeoutExceeded;
    });

    window.setTimeout(function () {
        ok(timeoutExceededError);

        iframe.addEventListener('load', function () {
            iframe.parentNode.removeChild(iframe);
        });

        messageSandbox.PING_IFRAME_TIMEOUT = storedDelay;

        start();
    }, 20);

    document.body.appendChild(iframe);
});

