var settings     = hammerhead.settings;

var Promise       = hammerhead.Promise;
var browserUtils  = hammerhead.utils.browser;
var transport     = hammerhead.transport;
var nativeMethods = hammerhead.nativeMethods;

var nativeLocalStorage = nativeMethods.winLocalStorageGetter.call(window);

function sendAsyncServiceMsgWithDisableResendingFlag () {
    return new Promise(function (resolve, reject) {
        transport.asyncServiceMsg({ disableResending: true, rejectForTest: true })
            .then(function () {
                reject('message should not be sent');
            });

        window.setTimeout(resolve, 100);
    });
}

test('sendAsyncServiceMsg', function () {
    return transport.asyncServiceMsg({ test: 'testValue' })
        .then(function (response) {
            strictEqual(response.test, 'testValue');
            strictEqual(response.sessionId, 'sessionId');
        });
});

test('queuedAsyncServiceMsg', function () {
    var sendQueuedMsg = function (msg) {
        return transport.queuedAsyncServiceMsg(msg)
            .then(function (result) {
                result.timestamp = Date.now();
                return result;
            });
    };

    var msgPromises = [
        sendQueuedMsg({ cmd: 'Type1', delay: 500 }),
        sendQueuedMsg({ cmd: 'Type2', delay: 10 }),
        sendQueuedMsg({ cmd: 'Type1', delay: 200 }),
        sendQueuedMsg({ cmd: 'Type1', delay: 300 }),
        sendQueuedMsg({ cmd: 'Type1', delay: 200 }),
    ];

    return Promise.all(msgPromises)
        .then(function (results) {
            results = results
                .sort(function (result1, result2) {
                    return result1.timestamp - result2.timestamp;
                })
                .map(function (result) {
                    return result.delay;
                });

            deepEqual(results, [10, 500, 200, 300, 200]);
        });
});

test('batchUpdate - without stored messages', function () {
    return transport.batchUpdate()
        .then(function () {
            ok(true);
        });
});

test('batchUpdate - with stored messages', function () {
    var savedQueuedAsyncServiceMsg = transport._implementation.queuedAsyncServiceMsg;
    var result                     = 0;

    transport._implementation.queuedAsyncServiceMsg = function (item) {
        return new Promise(function (resolve) {
            result += item.duration;
            resolve();
        });
    };

    var messages = [
        { cmd: 'Type1', duration: 10 },
        { cmd: 'Type2', duration: 20 },
        { cmd: 'Type3', duration: 30 },
    ];

    nativeMethods.storageSetItem.call(nativeLocalStorage, settings.get().sessionId, JSON.stringify(messages));

    return transport.batchUpdate()
        .then(function () {
            strictEqual(result, 60);

            transport._implementation.queuedAsyncServiceMsg = savedQueuedAsyncServiceMsg;
        });
});

if (!browserUtils.isWebKit && !browserUtils.isFirefox) {
    test('resend aborted async service msg', function () {
        return transport.asyncServiceMsg({ rejectForTestOnce: true })
            .then(function (response) {
                strictEqual(response.retriesCount, 2);
            });
    });
}
else {
    test('resend aborted async service msg (WebKit)', function () {
        settings.get().sessionId = '%%%testUid%%%';

        var requestId = Math.random();

        ok(!nativeMethods.storageGetItem.call(nativeLocalStorage, settings.get().sessionId));

        return transport.asyncServiceMsg({ id: requestId, rejectForTest: true })
            .then(function () {
                var storedMsgStr = nativeMethods.storageGetItem.call(nativeLocalStorage, settings.get().sessionId);
                var storedMsg    = JSON.parse(storedMsgStr)[0];

                ok(storedMsgStr);
                strictEqual(storedMsg.id, requestId);

                nativeMethods.storageRemoveItem.call(nativeLocalStorage, settings.get().sessionId);
            });
    });

    test('do not duplicate messages in store (WebKit)', function () {
        settings.get().sessionId = '%%%testUid%%%';

        ok(!nativeMethods.storageGetItem.call(nativeLocalStorage, settings.get().sessionId));

        var msg         = { test: 'testValue', rejectForTest: true };
        var msgPromises = [
            transport.asyncServiceMsg(msg),
            transport.asyncServiceMsg(msg),
        ];

        return Promise.all(msgPromises)
            .then(function () {
                var storedMsgStr = nativeMethods.storageGetItem.call(nativeLocalStorage, settings.get().sessionId);
                var storedMsgArr = JSON.parse(storedMsgStr);

                strictEqual(storedMsgArr.length, 1);

                nativeMethods.storageRemoveItem.call(nativeLocalStorage, settings.get().sessionId);
            });
    });

    test('do not resend aborted async service msg if it contains "disableResending" flag (WebKit)', function () {
        settings.get().sessionId = '%%%testUid%%%';

        ok(!nativeMethods.storageGetItem.call(nativeLocalStorage, settings.get().sessionId));

        return sendAsyncServiceMsgWithDisableResendingFlag()
            .then(function () {
                var storedMsgStr = nativeMethods.storageGetItem.call(nativeLocalStorage, settings.get().sessionId);

                strictEqual(storedMsgStr, null);

                nativeMethods.storageRemoveItem.call(nativeLocalStorage, settings.get().sessionId);
            });
    });
}

test('asyncServiceMessage - should reject if enableRejecting is true', function () {
    return transport.asyncServiceMsg({ disableResending: true, allowRejecting: true, rejectForTest: true })
        .then(function () {
            throw new Error('Promise rejection expected');
        })
        .catch(function (error) {
            strictEqual(error.message, 'XHR request failed with 0 status code.');
        });
});

test('queuedAsyncServiceMessage - should work with failed and rejected attempts', function () {
    let firstMsgResolved  = false;
    let firstMsgRejected  = false;
    let secondMsgRejected = false;
    let thirdMsgResolved  = false;

    // NOTE: expected to fail, but not reject
    transport
        .queuedAsyncServiceMsg({ disableResending: true, rejectForTest: true })
        .then(function () {
            firstMsgResolved = true;
        })
        .catch(function () {
            firstMsgRejected = true;
        });

    // NOTE: expected to fail and reject
    const secondMsgPromise = transport
        .queuedAsyncServiceMsg({ disableResending: true, allowRejecting: true, rejectForTest: true })
        .catch(function () {
            secondMsgRejected = true;
        });

    // NOTE: expected to pass
    const thirdMsgPromise = transport
        .queuedAsyncServiceMsg({ disableResending: true, allowRejecting: true })
        .then(function () {
            thirdMsgResolved = true;
        });

    return Promise
        .all([secondMsgPromise, thirdMsgPromise])
        .then(function () {
            ok(!firstMsgResolved);
            ok(!firstMsgRejected);
            ok(secondMsgRejected);
            ok(thirdMsgResolved);
        });
});

test('should use worker from top window for transport', function () {
    var resultStr = '';

    return createTestIframe()
        .then(function (iframe) {
            var iframeTransport = iframe.contentWindow['%hammerhead%'].transport;
            var processResult   = function (result) {
                resultStr += ' ' + result.cmd + ':' + result.delay;
            };

            var promises = [
                transport.queuedAsyncServiceMsg({ cmd: 'first', delay: 400 }).then(processResult),
                iframeTransport.queuedAsyncServiceMsg({ cmd: 'first', delay: 100 }).then(processResult),
                transport.asyncServiceMsg({ cmd: 'first', delay: 120 }).then(processResult),
            ];

            return Promise.all(promises);
        })
        .then(function () {
            strictEqual(resultStr, ' first:120 first:400 first:100');
        });
});

test('should send queued messages', function () {
    var iframeTransport = null;

    return createTestIframe()
        .then(function (iframe) {
            iframeTransport = iframe.contentWindow['%hammerhead%'].transport;
        })
        .then(function () {
            strictEqual(iframeTransport._implementation._transportWorker, null);
            strictEqual(iframeTransport._implementation._queue.length, 0);

            var msgPromise = iframeTransport.asyncServiceMsg({ test: 'me' });

            strictEqual(iframeTransport._implementation._queue.length, 1);
            strictEqual(iframeTransport._implementation._queue[0].queued, false);
            strictEqual(iframeTransport._implementation._queue[0].msg.test, 'me');

            return msgPromise;
        })
        .then(function (response) {
            strictEqual(iframeTransport._implementation._queue.length, 0);
            strictEqual(response.test, 'me');

            iframeTransport.asyncServiceMsg({ test: 'cafe' });

            strictEqual(iframeTransport._implementation._queue.length, 0);
        });
});

module('regression');

test('hammerhead should remove service data from local storage on the first session page load (GH-100)', function () {
    var sessionId = settings.get().sessionId;

    // NOTE: First page loading.
    settings.get().isFirstPageLoad = true;

    // NOTE: Add service data.
    nativeMethods.storageSetItem.call(nativeLocalStorage, sessionId, 'some-serive-data');

    var hh = new hammerhead.constructor(window);

    hh.start(settings.get(), window);

    ok(!nativeMethods.storageGetItem.call(nativeLocalStorage, sessionId));
});

test('failed service messages should respond via error handler (GH-1839)', function () {
    return transport.asyncServiceMsg({ disableResending: true, allowRejecting: true, rejectForTest500: true })
        .then(function () {
            ok(false, 'Promise rejection expected');
        })
        .catch(function (error) {
            strictEqual(error.message, 'XHR request failed with 500 status code.\nError message: An error occurred!!!');
        });
});

