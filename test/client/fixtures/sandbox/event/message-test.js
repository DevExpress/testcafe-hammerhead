var INSTRUCTION = hammerhead.PROCESSING_INSTRUCTIONS.dom.script;

var Promise        = hammerhead.Promise;
var messageSandbox = hammerhead.sandbox.event.message;

asyncTest('onmessage event (handler has "object" type) (GH-133)', function () {
    var testMessage = 'test';

    var eventHandlerObject = {
        handleEvent: function (e) {
            strictEqual(e.data, testMessage);
            strictEqual(this, eventHandlerObject);
            window.removeEventListener('message', eventHandlerObject);
            start();
        },
    };

    window.addEventListener('message', eventHandlerObject);
    callMethod(window, 'postMessage', [testMessage, '*']);
});

asyncTest('should pass "transfer" argument for "postMessage" (GH-1535)', function () {
    var channel = new MessageChannel();

    var eventHandlerObject = {
        handleEvent: function (e) {
            strictEqual(e.data, 'test');
            strictEqual(e.ports.length, 1);
            window.removeEventListener('message', eventHandlerObject);
            start();
        },
    };

    window.addEventListener('message', eventHandlerObject);
    callMethod(window, 'postMessage', ['test', '*', [channel.port1]]);
});

asyncTest('onmessage event', function () {
    var count = 0;

    var onMessageHandler = function (evt) {
        var rawData = evt.data;
        var data    = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;

        strictEqual(evt.origin, 'http://origin_iframe_host');
        strictEqual(data.msg, 'https://example.com');

        count++;

        if (count === 4) {
            window.removeEventListener('message', onMessageHandler);
            window.onmessage = void 0;
            start();
        }
    };

    createTestIframe({ src: getCrossDomainPageUrl('../../../data/cross-domain/get-message.html') })
        .then(function (iframe) {
            window.onmessage = onMessageHandler;
            window.addEventListener('message', onMessageHandler);
            callMethod(iframe.contentWindow, 'postMessage', ['', '*']);
        });
});

asyncTest('cross domain messages should follow the "targetOrigin" rule (GH-2165)', function () {
    var recievedMessages = [];

    var onMessageHandler = function (evt) {
        if (recievedMessages.push(evt.data) === 2) {
            ok(recievedMessages.indexOf('Should pass an origin check: correct targetOrigin') > -1, 'https://example.com/');
            ok(recievedMessages.indexOf('Should pass an origin check: no targetOrigin preference ("*")') > -1, '*');

            window.removeEventListener('message', onMessageHandler);

            start();
        }
    };

    window.addEventListener('message', onMessageHandler);

    createTestIframe({ src: getCrossDomainPageUrl('../../../data/cross-domain/targetorigin-message-to-top.html') });
});

test('message types', function () {
    var checkValue = function (value, test) {
        return new Promise(function (resolve) {
            window.onmessage = function (e) {
                if (test)
                    ok(test(e.data));
                else
                    strictEqual(e.data, value);

                window.onmessage = void 0;

                resolve();
            };

            callMethod(window, 'postMessage', [value, '*']);
        });
    };

    return checkValue(true)
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
        });
});

asyncTest('message to current window', function () {
    var onMessageHandler = function (evt) {
        strictEqual(evt.data, 'data123');

        window.removeEventListener('message', onMessageHandler);
        start();
    };

    window.addEventListener('message', onMessageHandler);
    window[INSTRUCTION.getPostMessage](null, postMessage)('data123', '*');
});

test('fake postMessage', function () {
    expect(1);

    function postMessage () {
        ok(true);
    }

    window[INSTRUCTION.getPostMessage](null, postMessage)('data123', '*');
});

module('service messages');

asyncTest('cloning arguments', function () {
    createTestIframe()
        .then(function (iframe) {
            var sourceObj = { testObject: true, cmd: 'qunit-test' };
            var iframeMessageSandbox = iframe.contentWindow['%hammerhead%'].sandbox.event.message;

            iframeMessageSandbox.on(messageSandbox.SERVICE_MSG_RECEIVED_EVENT, function (e) {
                if (e.message.cmd !== sourceObj.cmd)
                    return;

                ok(e.message.testObject);
                e.message.modified = true;
                ok(!sourceObj.modified);

                start();
            });
            messageSandbox.sendServiceMsg(sourceObj, iframe.contentWindow);
        });
});

test('crossdomain', function () {
    var serviceMsgReceived   = false;
    var serviceMsgHandler    = function () {
        serviceMsgReceived = true;
    };
    var isServiceMsgReceived = function () {
        return serviceMsgReceived;
    };

    return createTestIframe({ src: getCrossDomainPageUrl('../../../data/cross-domain/service-message.html') })
        .then(function (iframe) {
            messageSandbox.on(messageSandbox.SERVICE_MSG_RECEIVED_EVENT, serviceMsgHandler);
            messageSandbox.sendServiceMsg('service_msg', iframe.contentWindow);

            return window.QUnitGlobals.wait(isServiceMsgReceived);
        })
        .then(function () {
            ok(serviceMsgReceived);

            messageSandbox.off(messageSandbox.SERVICE_MSG_RECEIVED_EVENT, serviceMsgHandler);
        });
});

asyncTest('service message handler should not call other handlers', function () {
    var windowHandlerExecuted = false;
    var windowMessageHandler  = function () {
        windowHandlerExecuted = true;
    };
    var serviceMsgHandler     = function (evt) {
        window.setTimeout(function () {
            ok(!windowHandlerExecuted);
            strictEqual(evt.message, 'successfully');

            window.removeEventListener('message', windowMessageHandler);
            messageSandbox.off(messageSandbox.SERVICE_MSG_RECEIVED_EVENT, serviceMsgHandler);

            start();
        }, 100);
    };

    createTestIframe({ src: getCrossDomainPageUrl('../../../data/cross-domain/service-message-with-handlers.html') })
        .then(function (iframe) {
            window.onmessage = windowMessageHandler;
            window.addEventListener('message', windowMessageHandler);
            messageSandbox.on(messageSandbox.SERVICE_MSG_RECEIVED_EVENT, serviceMsgHandler);
            messageSandbox.sendServiceMsg('service_msg', iframe.contentWindow);
        });
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

    iframe.src = getCrossDomainPageUrl('../../../data/cross-domain/wait-loading.html');
    document.body.appendChild(iframe);
});

test('timeout (non-added to DOM iframe)', function () {
    var iframe      = document.createElement('iframe');
    var storedDelay = messageSandbox.PING_IFRAME_TIMEOUT;

    messageSandbox.PING_IFRAME_TIMEOUT = 5;

    iframe.id  = 'test' + Date.now();
    iframe.src = 'http://cross.domain.com/';

    return messageSandbox.pingIframe(iframe, 'pingCmd')
        .then(function () {
            ok(false, 'ping should not be resolved');
        }, function () {
            ok(true, 'ping should be rejected');
        })
        .then(function () {
            messageSandbox.PING_IFRAME_TIMEOUT = storedDelay;
        });
});

test('timeout (added to DOM iframe)', function () {
    var storedDelay = messageSandbox.PING_IFRAME_TIMEOUT;

    messageSandbox.PING_IFRAME_TIMEOUT = 5;

    return createTestIframe({ src: 'http://cross.domain.com/' })
        .then(function (iframe) {
            return messageSandbox.pingIframe(iframe, 'pingCmd');
        })
        .then(function () {
            ok(false, 'ping should not be resolved');
        }, function () {
            ok(true, 'ping should be rejected');
        })
        .then(function () {
            messageSandbox.PING_IFRAME_TIMEOUT = storedDelay;
        });
});

module('regression');

asyncTest('send message from iframe with "about:blank" src (GH-1026)', function () {
    var iframe = document.createElement('iframe');

    iframe.id  = 'test-' + Date.now();
    iframe.src = 'javascript:\'<html><body><script>window.parent.postMessage("gh1026", "*")<' + '/script></body></html>\'';

    window.onmessage = function (e) {
        if (e.data !== 'gh1026')
            return;

        iframe.parentNode.removeChild(iframe);
        window.onmessage = void 0;
        ok(true);
        start();
    };

    document.body.appendChild(iframe);
});

asyncTest('service messages from embedded iframe (GH-803)', function () {
    var iframe = document.createElement('iframe');

    iframe.id = 'test-' + Date.now();

    messageSandbox.on(messageSandbox.SERVICE_MSG_RECEIVED_EVENT, function (e) {
        if (e.message.embeddedIframesTestPassed) {
            iframe.parentNode.removeChild(iframe);
            ok(true);
            start();
        }
    });

    iframe.src = getSameDomainPageUrl('../../../data/event-sandbox/embedded-iframes.html');

    document.body.appendChild(iframe);
});

asyncTest('send service message to the recreated iframe (GH-814)', function () {
    var iframe = null;

    messageSandbox.on(messageSandbox.SERVICE_MSG_RECEIVED_EVENT, function (e) {
        if (e.message.gh814) {
            ok(true);
            start();
        }
    });

    createTestIframe()
        .then(function (createdIframe) {
            iframe = createdIframe;

            var iframeDocument = iframe.contentDocument;

            iframeDocument.open();
            iframeDocument.write('<html><body></body></html>');
            iframeDocument.close();

            return window.QUnitGlobals.waitForIframe(iframe);
        })
        .then(function () {
            var iframeWindow         = iframe.contentWindow;
            var iframeMessageSandbox = iframeWindow['%hammerhead%'].sandbox.event.message;

            iframeMessageSandbox.on(iframeMessageSandbox.SERVICE_MSG_RECEIVED_EVENT, function (e) {
                if (e.message.gh814)
                    iframeMessageSandbox.sendServiceMsg({ gh814: true }, iframeWindow.parent);
            });

            messageSandbox.sendServiceMsg({ gh814: true }, iframe.contentWindow);
        });
});

test('service message from removed iframe (GH-64)', function () {
    var receivedMessages  = 0;

    messageSandbox.on(messageSandbox.SERVICE_MSG_RECEIVED_EVENT, function (e) {
        if (e.message.cmd === 'qunit-test-gh-64')
            ++receivedMessages;
    });

    return createTestIframe({ src: getSameDomainPageUrl('../../../data/same-domain/service-message-from-removed-iframe.html') })
        .then(function () {
            return window.QUnitGlobals.wait(function () {
                return receivedMessages === 2;
            });
        })
        .then(function () {
            strictEqual(receivedMessages, 2);
        });
});

test('should not raise an error for sendServiceMessage if window.top is a cross-domain window (GH-666)', function () {
    var messageData       = null;
    var isMessageReceived = function () {
        return !!messageData;
    };
    var onMessageHandler  = function (e) {
        messageData = e.data;
    };

    window.addEventListener('message', onMessageHandler);

    var src = getCrossDomainPageUrl('../../../data/event-sandbox/send-message-when-top-window-is-cross-domain.html');

    return createTestIframe({ src: src })
        .then(function () {
            return window.QUnitGlobals.wait(isMessageReceived);
        })
        .then(function () {
            ok(!messageData.errorIsRaised);
            window.removeEventListener('message', onMessageHandler);
        });
});

test('MessageEvent should be correctly overridden (GH-1445)', function () {
    return createTestIframe()
        .then(function (iframe) {
            var iframeWindow = iframe.contentWindow;

            iframeWindow['%hammerhead%'].sandbox.event.message.postMessage(window, ['message', '*']);

            return new Promise(function (resolve) {
                window.addEventListener('message', resolve);
            });
        })
        .then(function (eventObj) {
            ok(eventObj instanceof window.MessageEvent);
            strictEqual(eventObj.data, 'message');
            strictEqual(eventObj.origin, 'https://example.com');

            try {
                ok(JSON.stringify(eventObj));
            }
            catch (e) {
                ok(false);
            }
        });
});
