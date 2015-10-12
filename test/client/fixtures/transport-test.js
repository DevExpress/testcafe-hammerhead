var Browser       = Hammerhead.get('./utils/browser');
var Transport     = Hammerhead.get('./transport');
var NativeMethods = Hammerhead.get('./sandbox/native-methods');
var Settings      = Hammerhead.get('./settings');
var Promise       = Hammerhead.get('es6-promise').Promise;

var savedAjaxOpenMethod = NativeMethods.XMLHttpRequest.prototype.open;
var savedAjaxSendMethod = NativeMethods.XMLHttpRequest.prototype.send;

var requestIsAsync = false;

Settings.get().serviceMsgUrl = '/service-msg/100';

function reqisterAfterAjaxSendHook (callback) {
    callback = callback || function () {};

    NativeMethods.XMLHttpRequest.prototype.open = function () {
        requestIsAsync = arguments[2];
        if (typeof requestIsAsync === 'undefined')
            requestIsAsync = true;

        savedAjaxOpenMethod.apply(this, arguments);
    };
    NativeMethods.XMLHttpRequest.prototype.send = function () {
        savedAjaxSendMethod.apply(this, arguments);
        callback(this);
    };
}
function unregisterAfterAjaxSendHook () {
    NativeMethods.XMLHttpRequest.prototype.open = savedAjaxOpenMethod;
    NativeMethods.XMLHttpRequest.prototype.send = savedAjaxSendMethod;
}

test('sendServiceMsg', function () {
    expect(3);

    var msg = {
        test: 'testValue'
    };

    reqisterAfterAjaxSendHook();

    Transport.syncServiceMsg(msg, function (responseText, parsedResponceText) {
        strictEqual(responseText, 100);
        strictEqual(typeof parsedResponceText, 'undefined');

        ok(!requestIsAsync);
        unregisterAfterAjaxSendHook();
    });
});

asyncTest('sendAsyncServiceMsg', function () {
    expect(3);

    var msg = {
        test: 'testValue'
    };

    reqisterAfterAjaxSendHook();

    Transport.asyncServiceMsg(msg)
        .then(function (responseText, parsedResponceText) {
            strictEqual(responseText, 100);
            strictEqual(typeof parsedResponceText, 'undefined');
            ok(requestIsAsync);

            unregisterAfterAjaxSendHook();
            start();
        });
});

asyncTest('queuedAsyncServiceMsg', function () {
    var savedAsyncServiceMsgFunc = Transport.asyncServiceMsg;

    Transport.asyncServiceMsg = function (msg) {
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

            Transport.asyncServiceMsg = savedAsyncServiceMsgFunc;

            start();
        }
    };

    expect(1);

    Transport.queuedAsyncServiceMsg({ cmd: 'Type1', duration: 500 }).then(msgCallback);
    Transport.queuedAsyncServiceMsg({ cmd: 'Type2', duration: 10 }).then(msgCallback);
    Transport.queuedAsyncServiceMsg({ cmd: 'Type1', duration: 200 }).then(msgCallback);
    Transport.queuedAsyncServiceMsg({ cmd: 'Type1', duration: 300 }).then(msgCallback);
    Transport.queuedAsyncServiceMsg({ cmd: 'Type1', duration: 200 }).then(msgCallback);

});

asyncTest('batchUpdate - without stored messages', function () {
    expect(1);

    Transport.batchUpdate().then(function () {
        ok(true);
        start();
    });
});

asyncTest('batchUpdate - with stored messages', function () {
    expect(2);

    var savedQueuedAsyncServiceMsg = Transport.queuedAsyncServiceMsg;

    var result = 0;

    var updateCallback = function () {
        ok(true);
        strictEqual(result, 60);

        Transport.queuedAsyncServiceMsg = savedQueuedAsyncServiceMsg;
        start();
    };

    var messages = [
        { cmd: 'Type1', duration: 10 },
        { cmd: 'Type2', duration: 20 },
        { cmd: 'Type3', duration: 30 }
    ];

    Transport.queuedAsyncServiceMsg = function (item) {
        return new Promise(function (resolve) {
            result += item.duration;
            resolve();
        });
    };

    window.localStorage.setItem(Settings.get().sessionId, JSON.stringify(messages));
    Transport.batchUpdate().then(updateCallback);
});

if (!Browser.isWebKit) {
    asyncTest('Resend aborted async service msg', function () {
        var xhrCount      = 0;
        var callbackCount = 0;

        var onAjaxSend = function (xhr) {
            xhrCount++;

            var expectedAsync = xhrCount === 1;

            strictEqual(requestIsAsync, expectedAsync);

            xhr.abort();
        };

        reqisterAfterAjaxSendHook(onAjaxSend);

        Transport.asyncServiceMsg({})
            .then(function () {
                callbackCount++;
            });

        expect(3);

        window.setTimeout(function () {
            strictEqual(callbackCount, 1);

            unregisterAfterAjaxSendHook();
            start();
        }, 200);
    });
}
else {
    asyncTest('Resend aborted async service msg (WebKit)', function () {
        Settings.get().sessionId = '%%%testUid%%%';

        var xhrCount      = 0;
        var callbackCount = 0;
        var value         = 'testValue';

        ok(!window.localStorage.getItem(Settings.get().sessionId));

        var onAjaxSend = function (xhr) {
            xhrCount++;
            xhr.abort();
        };

        reqisterAfterAjaxSendHook(onAjaxSend);

        var msg = {
            test: value
        };

        Transport.asyncServiceMsg(msg)
            .then(function () {
                callbackCount++;
            });

        window.setTimeout(function () {
            strictEqual(callbackCount, 1);
            strictEqual(xhrCount, 1);

            var storedMsgStr = window.localStorage.getItem(Settings.get().sessionId);
            var storedMsg    = JSON.parse(storedMsgStr)[0];

            ok(storedMsgStr);
            strictEqual(storedMsg.test, value);

            unregisterAfterAjaxSendHook();

            window.localStorage.removeItem(Settings.get().sessionId);
            start();
        }, 200);
    });

    asyncTest('Do not dublicate messages in store (WebKit)', function () {
        Settings.get().sessionId = '%%%testUid%%%';

        var callbackCount = 0;
        var value         = 'testValue';

        ok(!window.localStorage.getItem(Settings.sessionId));

        var onAjaxSend = function (xhr) {
            xhr.abort();
        };

        reqisterAfterAjaxSendHook(onAjaxSend);

        var msg = {
            test: value
        };

        Transport.asyncServiceMsg(msg)
            .then(function () {
                callbackCount++;
            });

        Transport.asyncServiceMsg(msg)
            .then(function () {
                callbackCount++;
            });

        unregisterAfterAjaxSendHook();

        window.setTimeout(function () {
            strictEqual(callbackCount, 2);

            var storedMsgStr = window.localStorage.getItem(Settings.get().sessionId);
            var storedMsgArr = JSON.parse(storedMsgStr);

            strictEqual(storedMsgArr.length, 1);

            window.localStorage.removeItem(Settings.get().sessionId);
            start();
        }, 200);
    });
}

module('regression');

test('Hammerhead should remove service data from local storage on the first session page load (GH-100)', function () {
    var sessionId = Settings.get().sessionId;

    // First page loading
    Settings.get().isFirstPageLoad = true;

    // Add service data
    window.localStorage.setItem(sessionId, 'some-serive-data');

    var hammerhead = new Hammerhead.constructor(window);

    hammerhead.start(Settings.get(), window);

    ok(!window.localStorage.getItem(sessionId));
});

