var Browser         = Hammerhead.get('./util/browser');
var ScriptProcessor = Hammerhead.get('../processing/script');
var IFrameSandbox   = Hammerhead.get('./sandboxes/iframe');
var MessageSandbox  = Hammerhead.get('./sandboxes/message');
var Settings        = Hammerhead.get('./settings');

QUnit.testStart = function () {
    IFrameSandbox.on(IFrameSandbox.IFRAME_READY_TO_INIT, initIFrameTestHandler);
    IFrameSandbox.off(IFrameSandbox.IFRAME_READY_TO_INIT, IFrameSandbox.iframeReadyToInitHandler);
};

QUnit.testDone = function () {
    IFrameSandbox.off(IFrameSandbox.IFRAME_READY_TO_INIT, initIFrameTestHandler);
};

asyncTest('onmessage event', function () {
    var $iframe               = $('<iframe>');
    var storedCrossDomainPort = Settings.get().CROSS_DOMAIN_PROXY_PORT;
    var count                 = 0;

    Settings.get().CROSS_DOMAIN_PROXY_PORT = 1336;

    $iframe[0].src = window.getCrossDomainPageUrl('get-message.html');
    $iframe.appendTo('body');

    var onMessageHandler = function (evt) {
        var data = typeof evt.data === 'string' ? JSON.parse(evt.data) : evt.data;

        strictEqual(evt.origin, 'http://origin_iframe_host');
        strictEqual(data.msg, 'https://example.com');

        count++;

        if (count === 2) {
            Settings.get().CROSS_DOMAIN_PROXY_PORT = storedCrossDomainPort;
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

    iframe.src = window.getCrossDomainPageUrl('target-url.html');
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

        this.contentWindow.Hammerhead.MessageSandbox.on(MessageSandbox.SERVICE_MSG_RECEIVED, function (e) {
            ok(e.message.testObject);
            e.message.modified = true;
            ok(!sourceObj.modified);
            iframe.parentNode.removeChild(iframe);

            start();
        });

        MessageSandbox.sendServiceMsg(sourceObj, this.contentWindow);
    });

    document.body.appendChild(iframe);
});

asyncTest('crossdomain', function () {
    var iframe                = document.createElement('iframe');
    var storedCrossDomainPort = Settings.get().CROSS_DOMAIN_PROXY_PORT;
    var serviceMsgReceived    = false;

    Settings.get().CROSS_DOMAIN_PROXY_PORT = 1336;

    var serviceMsgHandler = function () {
        serviceMsgReceived = true;
    };

    iframe.src = window.getCrossDomainPageUrl('service-message.html');
    iframe.addEventListener('load', function () {
        MessageSandbox.on(MessageSandbox.SERVICE_MSG_RECEIVED, serviceMsgHandler);
        MessageSandbox.sendServiceMsg('service_msg', this.contentWindow);

        window.setTimeout(function () {
            ok(serviceMsgReceived);

            Settings.get().CROSS_DOMAIN_PROXY_PORT = storedCrossDomainPort;
            iframe.parentNode.removeChild(iframe);
            MessageSandbox.off(MessageSandbox.SERVICE_MSG_RECEIVED, serviceMsgHandler);
            start();
        }, 200);
    });

    document.body.appendChild(iframe);
});

asyncTest('service message handler should not call other handlers', function () {
    var iframe                = document.createElement('iframe');
    var storedCrossDomainPort = Settings.get().CROSS_DOMAIN_PROXY_PORT;
    var windowHandlerExecuted = false;

    Settings.get().CROSS_DOMAIN_PROXY_PORT = 1336;

    var windowMessageHandler = function () {
        windowHandlerExecuted = true;
    };

    var serviceMsgHandler = function (evt) {
        window.setTimeout(function () {
            ok(!windowHandlerExecuted);
            strictEqual(evt.message, 'successfully');

            Settings.get().CROSS_DOMAIN_PROXY_PORT = storedCrossDomainPort;
            iframe.parentNode.removeChild(iframe);

            window.removeEventListener('message', windowMessageHandler);
            MessageSandbox.off(MessageSandbox.SERVICE_MSG_RECEIVED, serviceMsgHandler);

            start();
        }, 100);
    };

    iframe.src = window.getCrossDomainPageUrl('service-message-with-handlers.html');
    iframe.addEventListener('load', function () {
        eval(ScriptProcessor.process('window.onmessage = windowMessageHandler;'));
        window.addEventListener('message', windowMessageHandler);
        MessageSandbox.on(MessageSandbox.SERVICE_MSG_RECEIVED, serviceMsgHandler);
        MessageSandbox.sendServiceMsg('service_msg', this.contentWindow);
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

    MessageSandbox.pingIFrame(iframe, 'pingCmd', function () {
        iFrameResponseReceived = true;
    });

    iframe.src = window.getCrossDomainPageUrl('wait-loading.html');
    document.body.appendChild(iframe);
});

asyncTest('timeout', function () {
    var iframe               = document.createElement('iframe');
    var timeoutExceededError = false;
    var storedDelay          = MessageSandbox.PING_IFRAME_TIMEOUT;

    MessageSandbox.setPingIFrameTimeout(5);

    iframe.src = 'http://cross.domain.com/';

    MessageSandbox.pingIFrame(iframe, 'pingCmd', function (timeoutExceeded) {
        timeoutExceededError = timeoutExceeded;
    });

    window.setTimeout(function () {
        ok(timeoutExceededError);

        iframe.addEventListener('load', function () {
            iframe.parentNode.removeChild(iframe);
        });

        MessageSandbox.PING_IFRAME_TIMEOUT = storedDelay;

        start();
    }, 20);

    document.body.appendChild(iframe);
});

