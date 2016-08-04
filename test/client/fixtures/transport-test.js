var settings = hammerhead.get('./settings');

var Promise       = hammerhead.Promise;
var browserUtils  = hammerhead.utils.browser;
var transport     = hammerhead.transport;
var nativeMethods = hammerhead.nativeMethods;

var savedAjaxOpenMethod = nativeMethods.xmlHttpRequestOpen;
var savedAjaxSendMethod = nativeMethods.xmlHttpRequestSend;

var requestIsAsync = false;

settings.get().serviceMsgUrl = '/service-msg/100';

function registerAfterAjaxSendHook (callback) {
    callback = callback || function () {};

    nativeMethods.xmlHttpRequestOpen = function () {
        requestIsAsync = arguments[2];
        if (typeof requestIsAsync === 'undefined')
            requestIsAsync = true;

        savedAjaxOpenMethod.apply(this, arguments);
    };
    nativeMethods.xmlHttpRequestSend = function () {
        savedAjaxSendMethod.apply(this, arguments);
        callback(this);
    };
}
function unregisterAfterAjaxSendHook () {
    nativeMethods.xmlHttpRequestOpen = savedAjaxOpenMethod;
    nativeMethods.xmlHttpRequestSend = savedAjaxSendMethod;
}

asyncTest('sendAsyncServiceMsg', function () {
    expect(3);

    var msg = {
        test: 'testValue'
    };

    registerAfterAjaxSendHook();

    transport.asyncServiceMsg(msg)
        .then(function (responseText, parsedResponseText) {
            strictEqual(responseText, 100);
            strictEqual(typeof parsedResponseText, 'undefined');
            ok(requestIsAsync);

            unregisterAfterAjaxSendHook();
            start();
        });
});

asyncTest('queuedAsyncServiceMsg', function () {
    var savedAsyncServiceMsgFunc = transport.asyncServiceMsg;

    transport.asyncServiceMsg = function (msg) {
        return new Promise(function (resolve) {
            window.setTimeout(function () {
                resolve(msg.duration);
            }, msg.duration);
        });
    };

    var completeMsgReqs = [];

    var msgCallback = function (duration) {
        completeMsgReqs.push(duration);

        if (completeMsgReqs.length === 5) {
            var expectedCompleteMsgReqs = [10, 500, 200, 300, 200];

            deepEqual(completeMsgReqs, expectedCompleteMsgReqs);

            transport.asyncServiceMsg = savedAsyncServiceMsgFunc;

            start();
        }
    };

    expect(1);

    transport.queuedAsyncServiceMsg({ cmd: 'Type1', duration: 500 }).then(msgCallback);
    transport.queuedAsyncServiceMsg({ cmd: 'Type2', duration: 10 }).then(msgCallback);
    transport.queuedAsyncServiceMsg({ cmd: 'Type1', duration: 200 }).then(msgCallback);
    transport.queuedAsyncServiceMsg({ cmd: 'Type1', duration: 300 }).then(msgCallback);
    transport.queuedAsyncServiceMsg({ cmd: 'Type1', duration: 200 }).then(msgCallback);

});

asyncTest('batchUpdate - without stored messages', function () {
    expect(1);

    transport.batchUpdate().then(function () {
        ok(true);
        start();
    });
});

asyncTest('batchUpdate - with stored messages', function () {
    expect(2);

    var savedQueuedAsyncServiceMsg = transport.queuedAsyncServiceMsg;
    var result                     = 0;

    var updateCallback = function () {
        ok(true);
        strictEqual(result, 60);

        transport.queuedAsyncServiceMsg = savedQueuedAsyncServiceMsg;
        start();
    };

    var messages = [
        { cmd: 'Type1', duration: 10 },
        { cmd: 'Type2', duration: 20 },
        { cmd: 'Type3', duration: 30 }
    ];

    transport.queuedAsyncServiceMsg = function (item) {
        return new Promise(function (resolve) {
            result += item.duration;
            resolve();
        });
    };

    window.localStorage.setItem(settings.get().sessionId, JSON.stringify(messages));
    transport.batchUpdate().then(updateCallback);
});

if (!browserUtils.isWebKit) {
    asyncTest('resend aborted async service msg', function () {
        var xhrCount           = 0;
        var callbackCount      = 0;
        var checkCallbackCount = function () {
            return callbackCount === 1;
        };

        var onAjaxSend = function (xhr) {
            xhrCount++;

            var expectedAsync = xhrCount === 1;

            strictEqual(requestIsAsync, expectedAsync);

            xhr.abort();
        };

        registerAfterAjaxSendHook(onAjaxSend);

        transport.asyncServiceMsg({})
            .then(function () {
                callbackCount++;
            });

        expect(2);

        window.QUnitGlobals.wait(checkCallbackCount)
            .then(function () {
                unregisterAfterAjaxSendHook();
                start();
            });
    });
}
else {
    asyncTest('resend aborted async service msg (WebKit)', function () {
        settings.get().sessionId = '%%%testUid%%%';

        var xhrCount           = 0;
        var callbackCount      = 0;
        var value              = 'testValue';
        var checkCallbackCount = function () {
            return callbackCount === 1;
        };

        ok(!window.localStorage.getItem(settings.get().sessionId));

        var onAjaxSend = function (xhr) {
            xhrCount++;
            xhr.abort();
        };

        registerAfterAjaxSendHook(onAjaxSend);

        var msg = {
            test: value
        };

        transport.asyncServiceMsg(msg)
            .then(function () {
                callbackCount++;
            });

        window.QUnitGlobals.wait(checkCallbackCount)
            .then(function () {
                strictEqual(xhrCount, 1);

                var storedMsgStr = window.localStorage.getItem(settings.get().sessionId);
                var storedMsg    = JSON.parse(storedMsgStr)[0];

                ok(storedMsgStr);
                strictEqual(storedMsg.test, value);

                unregisterAfterAjaxSendHook();

                window.localStorage.removeItem(settings.get().sessionId);
                start();
            });
    });

    asyncTest('do not dublicate messages in store (WebKit)', function () {
        settings.get().sessionId = '%%%testUid%%%';

        var callbackCount      = 0;
        var value              = 'testValue';
        var checkCallbackCount = function () {
            return callbackCount === 2;
        };

        ok(!window.localStorage.getItem(settings.get().sessionId));

        var onAjaxSend = function (xhr) {
            xhr.abort();
        };

        registerAfterAjaxSendHook(onAjaxSend);

        var msg = {
            test: value
        };

        transport.asyncServiceMsg(msg)
            .then(function () {
                callbackCount++;
            });

        transport.asyncServiceMsg(msg)
            .then(function () {
                callbackCount++;
            });

        unregisterAfterAjaxSendHook();

        window.QUnitGlobals.wait(checkCallbackCount)
            .then(function () {
                var storedMsgStr = window.localStorage.getItem(settings.get().sessionId);
                var storedMsgArr = JSON.parse(storedMsgStr);

                strictEqual(storedMsgArr.length, 1);

                window.localStorage.removeItem(settings.get().sessionId);
                start();
            });
    });
}

if (browserUtils.isWebKit) {
    asyncTest("do not resend aborted async service msg if it contains 'disableResending' flag (WebKit)", function () {
        settings.get().sessionId = '%%%testUid%%%';

        var xhrCount      = 0;
        var isMessageSent = false;

        ok(!window.localStorage.getItem(settings.get().sessionId));

        var onAjaxSend = function (xhr) {
            xhrCount++;
            xhr.abort();
        };

        registerAfterAjaxSendHook(onAjaxSend);

        var msg = {
            disableResending: true
        };

        transport.asyncServiceMsg(msg)
            .then(function () {
                isMessageSent = true;
            });

        window.setTimeout(function () {
            strictEqual(xhrCount, 1);

            var storedMsgStr = window.localStorage.getItem(settings.get().sessionId);

            notOk(isMessageSent);
            strictEqual(storedMsgStr, '[]');

            window.localStorage.removeItem(settings.get().sessionId);

            unregisterAfterAjaxSendHook();
            start();
        }, 100);
    });
}
else {
    asyncTest("do not resend aborted async service msg if it contains 'disableResending' flag", function () {
        var xhrCount      = 0;
        var isMessageSent = false;

        var onAjaxSend = function (xhr) {
            xhrCount++;
            xhr.abort();
        };

        registerAfterAjaxSendHook(onAjaxSend);

        var msg = {
            disableResending: true
        };

        transport.asyncServiceMsg(msg)
            .then(function () {
                isMessageSent = true;
            });

        window.setTimeout(function () {
            notOk(isMessageSent);
            strictEqual(xhrCount, 1);

            unregisterAfterAjaxSendHook();
            start();
        }, 100);
    });
}


module('regression');

test('hammerhead should remove service data from local storage on the first session page load (GH-100)', function () {
    var sessionId = settings.get().sessionId;

    // NOTE: First page loading.
    settings.get().isFirstPageLoad = true;

    // NOTE: Add service data.
    window.localStorage.setItem(sessionId, 'some-serive-data');

    var hh = new hammerhead.constructor(window);

    hh.redirectWatch.init = function () {
    };
    hh.start(settings.get(), window);

    ok(!window.localStorage.getItem(sessionId));
});

