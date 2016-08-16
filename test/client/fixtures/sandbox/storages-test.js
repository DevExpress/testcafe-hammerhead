var StorageWrapper = hammerhead.get('./sandbox/storages/wrapper');
var settings       = hammerhead.get('./settings');

var storageSandbox = hammerhead.sandbox.storageSandbox;
var iframeSandbox  = hammerhead.sandbox.iframe;
var Promise        = hammerhead.Promise;
var isIE           = hammerhead.utils.browser.isIE;

var storageWrapperKey = 'hammerhead|storage-wrapper|' + settings.get().sessionId + '|example.com';

QUnit.testStart(function () {
    // NOTE: Clean up storage wrappers
    window.localStorage.clear();
    window.sessionStorage.clear();
    storageSandbox.localStorage.clear();
    storageSandbox.sessionStorage.clear();

    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
});

function waitStorageUpdated () {
    return new Promise(function (resolve) {
        window.setTimeout(resolve, 100);
    });
}

function waitStorageEvent (window, action) {
    return new Promise(function (resolve) {
        var handler = function (e) {
            window.removeEventListener('storage', handler);
            resolve(e);
        };

        window.addEventListener('storage', handler);
        action();
    });
}

module('storage API');

test('argument types', function () {
    var storageWrapper = storageSandbox.localStorage;

    storageWrapper.setItem({}, 'value');
    strictEqual(storageWrapper.getItem({}), 'value');

    storageWrapper.setItem({}, null);
    strictEqual(storageWrapper.getItem({}), 'null');

    storageWrapper.setItem(null, 'value1');
    strictEqual(storageWrapper.getItem(null), 'value1');
});

test('get item', function () {
    var storageWrapper = storageSandbox.sessionStorage;

    storageWrapper.setItem('key1', 'value1');
    storageWrapper.setItem('key2', 'value2');

    strictEqual(storageWrapper.getItem('key1'), 'value1');
    strictEqual(storageWrapper.getItem('key2'), 'value2');
    strictEqual(storageWrapper.getItem('key3'), null);
});

test('set item', function () {
    var storageWrapper = storageSandbox.localStorage;

    storageWrapper.setItem('key1', 'value1');
    storageWrapper.setItem('key2', {});

    strictEqual(storageWrapper.length, 2);
    strictEqual(storageWrapper.getItem('key1'), 'value1');
    strictEqual(storageWrapper.getItem('key2'), '[object Object]');

    storageWrapper.setItem('key1', null);
    storageWrapper.setItem('key2', 'newValue');

    strictEqual(storageWrapper.length, 2);
    strictEqual(storageWrapper.getItem('key1'), 'null');
    strictEqual(storageWrapper.getItem('key2'), 'newValue');
});

test('get key', function () {
    var storageWrapper = storageSandbox.sessionStorage;

    storageWrapper.setItem('key1', 'value1');
    storageWrapper.setItem('key2', 'value2');

    strictEqual(storageWrapper.length, 2);
    strictEqual(storageWrapper.key(-1), null);
    strictEqual(storageWrapper.key(0), 'key1');
    strictEqual(storageWrapper.key(1), 'key2');
    strictEqual(storageWrapper.key(2), null);
});

test('remove item', function () {
    var storageWrapper = storageSandbox.localStorage;

    storageWrapper.setItem('key1', 'value1');
    storageWrapper.setItem('key2', 'value2');

    storageWrapper.removeItem('key3');
    strictEqual(storageWrapper.length, 2);
    storageWrapper.removeItem('key1');
    strictEqual(storageWrapper.length, 1);
    strictEqual(storageWrapper.getItem('key1'), null);
    strictEqual(storageWrapper.getItem('key2'), 'value2');
    strictEqual(storageWrapper.key(0), 'key2');
    strictEqual(storageWrapper.key(1), null);
});

test('storage length', function () {
    var storageWrapper = storageSandbox.sessionStorage;

    storageWrapper.clear();
    strictEqual(storageWrapper.length, 0);

    storageWrapper.setItem('key1', 'value1');
    strictEqual(storageWrapper.length, 1);

    storageWrapper.setItem('key2', 'value2');
    strictEqual(storageWrapper.length, 2);

    storageWrapper.removeItem('key2');
    strictEqual(storageWrapper.length, 1);

    storageWrapper.clear();
    strictEqual(storageWrapper.length, 0);
});

module('code instrumentation');

test('global invoke', function () {
    var localStorageWrapper   = storageSandbox.localStorage;
    var sessionStorageWrapper = storageSandbox.sessionStorage;

    eval(processScript('localStorage.key1 = "value1"'));
    eval(processScript('sessionStorage.key2 = "value2"'));

    strictEqual(localStorageWrapper.key1, 'value1');
    strictEqual(sessionStorageWrapper.key2, 'value2');

    localStorageWrapper.setItem('key3', 'value3');
    sessionStorageWrapper.setItem('key4', 'value4');

    strictEqual(eval(processScript('localStorage.key3')), 'value3');
    strictEqual(eval(processScript('sessionStorage.key4')), 'value4');

    eval(processScript('localStorage.setItem("key5", "value5")'));
    eval(processScript('sessionStorage.setItem("key6", "value6")'));

    strictEqual(localStorageWrapper.key5, 'value5');
    strictEqual(sessionStorageWrapper.key6, 'value6');

    eval(processScript('window.localStorage.setItem("key7", "value7")'));
    eval(processScript('window.sessionStorage.setItem("key8", "value8")'));

    strictEqual(localStorageWrapper.key7, 'value7');
    strictEqual(sessionStorageWrapper.key8, 'value8');

    eval(processScript('window["localStorage"].setItem("key9", "value9")'));
    eval(processScript('window["sessionStorage"].setItem("key10", "value10")'));

    strictEqual(localStorageWrapper.key9, 'value9');
    strictEqual(sessionStorageWrapper.key10, 'value10');

    eval(processScript('localStorage["setItem"]("key11", "value11")'));
    eval(processScript('sessionStorage["setItem"]("key12", "value12")'));

    strictEqual(localStorageWrapper.key11, 'value11');
    strictEqual(sessionStorageWrapper.key12, 'value12');

    eval(processScript('localStorage["key13"] = "value13"'));
    eval(processScript('sessionStorage["key14"] = "value14"'));

    strictEqual(localStorageWrapper.key13, 'value13');
    strictEqual(sessionStorageWrapper.key14, 'value14');

    eval(processScript('var key = "key15"; localStorage[key] = "value15"'));
    eval(processScript('var key = "key16"; sessionStorage[key] = "value16"'));

    strictEqual(localStorageWrapper.key15, 'value15');
    strictEqual(sessionStorageWrapper.key16, 'value16');
});

test('invoke as a member', function () {
    var localStorageWrapper   = storageSandbox.localStorage;
    var sessionStorageWrapper = storageSandbox.sessionStorage;

    strictEqual(eval(processScript('window.localStorage')), localStorageWrapper);
    strictEqual(eval(processScript('window.sessionStorage')), sessionStorageWrapper);

    strictEqual(eval(processScript('window["localStorage"]')), localStorageWrapper);
    strictEqual(eval(processScript('window["sessionStorage"]')), sessionStorageWrapper);

    /* eslint-disable no-unused-vars */
    var localStorageLiteral   = 'localStorage';
    var sessionStorageLiteral = 'sessionStorage';
    /* eslint-enable no-unused-vars */

    strictEqual(eval(processScript('window[localStorageLiteral]')), localStorageWrapper);
    strictEqual(eval(processScript('window[sessionStorageLiteral]')), sessionStorageWrapper);
});

module('direct record to the storage');

test('setter', function () {
    var storageWrapper = storageSandbox.sessionStorage;

    storageWrapper.key1 = 'value1';
    strictEqual(storageWrapper.getItem('key1'), 'value1');
    strictEqual(storageWrapper.length, 1);

    storageWrapper.key1 = 'newValue';
    strictEqual(storageWrapper.getItem('key1'), 'newValue');
    strictEqual(storageWrapper.length, 1);
});

test('getter', function () {
    var storageWrapper = storageSandbox.localStorage;

    storageWrapper.setItem('key1', 'value1');
    strictEqual(storageWrapper.key1, 'value1');

    storageWrapper.setItem('key1', null);
    strictEqual(storageWrapper.key1, 'null');

    storageWrapper.setItem(null, null);
    strictEqual(storageWrapper.null, 'null');

    storageWrapper.removeItem(null);
    strictEqual(storageWrapper.null, void 0);
});

module('area of visibility');

asyncTest('iframe with empty src', function () {
    var topStorage = storageSandbox.localStorage;
    var iframe     = document.createElement('iframe');

    iframe.id       = 'test001';
    topStorage.key1 = 'value1';

    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            var iframeStorage = iframe.contentWindow['%hammerhead%'].sandbox.storageSandbox.localStorage;

            strictEqual(iframeStorage.key1, 'value1');

            iframeStorage.key2 = 'value2';
            topStorage.key3    = 'value3';

            strictEqual(topStorage.key2, 'value2');
            strictEqual(iframeStorage.key3, 'value3');

            $(iframe).remove();
            start();
        });

    document.body.appendChild(iframe);
});

module('sync state with native');

test('storages load their state from native', function () {
    localStorage[storageWrapperKey]   = '[[ "key1" ],[ "value1" ]]';
    sessionStorage[storageWrapperKey] = '[[ "key2" ],[ "value2" ]]';

    var localSandboxWrapper   = new StorageWrapper(window, localStorage, storageWrapperKey, hammerhead.sandbox.event.listeners);
    var sessionSandboxWrapper = new StorageWrapper(window, sessionStorage, storageWrapperKey, hammerhead.sandbox.event.listeners);

    strictEqual(localSandboxWrapper.key1, 'value1');
    strictEqual(sessionSandboxWrapper.key2, 'value2');
});

test('storages save their state on the beforeunload event', function () {
    storageSandbox.localStorage.key1   = 'value1';
    storageSandbox.sessionStorage.key2 = 'value2';

    ok(!localStorage[storageWrapperKey]);
    ok(!sessionStorage[storageWrapperKey]);

    // NOTE: Simulate page leaving
    hammerhead.sandbox.event.unload._emitBeforeUnloadEvent();

    strictEqual(localStorage[storageWrapperKey], JSON.stringify([['key1'], ['value1']]));
    strictEqual(sessionStorage[storageWrapperKey], JSON.stringify([['key2'], ['value2']]));
});

module('storage changed event');

asyncTest('event firing in all same host windows', function () {
    var topStorage    = storageSandbox.localStorage;
    var iframeStorage = null;
    var iframe        = document.createElement('iframe');

    var topStorageEventArgs    = [];
    var iframeStorageEventArgs = [];

    var topWindowHandler = function (e) {
        topStorageEventArgs.push(e);
    };

    var iframeWindowHandler = function (e) {
        iframeStorageEventArgs.push(e);
    };

    iframe.id = 'test001';

    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            iframeStorage = iframe.contentWindow['%hammerhead%'].sandbox.storageSandbox.localStorage;

            window.addEventListener('storage', topWindowHandler);
            iframe.contentWindow.addEventListener('storage', iframeWindowHandler);

            iframeStorage.key1 = 'value1';

            return waitStorageUpdated();
        })
        .then(function () {
            strictEqual(topStorageEventArgs.length, 1);
            strictEqual(iframeStorageEventArgs.length, 1);

            strictEqual(topStorageEventArgs[0].key, 'key1');
            strictEqual(topStorageEventArgs[0].oldValue, isIE ? '' : null);
            strictEqual(topStorageEventArgs[0].newValue, 'value1');
            // NOTE: We can't detect who changed the storage.
            // strictEqual(topStorageEventArgs[0].url, 'https://iframe.example.com');
            strictEqual(topStorageEventArgs[0].storageArea, iframeStorage);

            strictEqual(iframeStorageEventArgs[0].key, 'key1');
            strictEqual(iframeStorageEventArgs[0].oldValue, isIE ? '' : null);
            strictEqual(iframeStorageEventArgs[0].newValue, 'value1');
            // NOTE: We can't detect who changed the storage.
            // strictEqual(iframeStorageEventArgs[0].url, 'https://iframe.example.com');
            strictEqual(iframeStorageEventArgs[0].storageArea, iframeStorage);

            topStorage.key2 = 'value2';

            return waitStorageUpdated();
        })
        .then(function () {
            strictEqual(topStorageEventArgs.length, 2);
            strictEqual(iframeStorageEventArgs.length, 2);

            strictEqual(topStorageEventArgs[1].key, 'key2');
            strictEqual(topStorageEventArgs[1].oldValue, isIE ? '' : null);
            strictEqual(topStorageEventArgs[1].newValue, 'value2');
            // NOTE: We can't detect who changed the storage.
            // strictEqual(topStorageEventArgs[1].url, 'https://example.com');
            strictEqual(topStorageEventArgs[1].storageArea, topStorage);

            strictEqual(iframeStorageEventArgs[1].key, 'key2');
            strictEqual(iframeStorageEventArgs[1].oldValue, isIE ? '' : null);
            strictEqual(iframeStorageEventArgs[1].newValue, 'value2');
            // NOTE: We can't detect who changed the storage.
            // strictEqual(iframeStorageEventArgs[1].url, 'https://example.com');
            strictEqual(iframeStorageEventArgs[1].storageArea, topStorage);

            window.removeEventListener('storage', topWindowHandler);
            $(iframe).remove();
            start();
        });

    document.body.appendChild(iframe);
});

asyncTest('event argument parameters', function () {
    storageSandbox.localStorage.clear();

    var checkEventArg = function (e, key, oldValue, newValue) {
        strictEqual(e.key, key);
        strictEqual(e.oldValue, oldValue);
        strictEqual(e.newValue, newValue);
        // NOTE: We can't detect who changed the storage.
        // strictEqual(e.url, 'https://example.com');
        strictEqual(e.storageArea, storageSandbox.localStorage);
    };

    waitStorageUpdated()
        .then(function () {
            return waitStorageEvent(window, function () {
                storageSandbox.localStorage.key1 = 'value1';
            });
        })
        .then(function (e) {
            checkEventArg(e, 'key1', isIE ? '' : null, 'value1');

            return waitStorageEvent(window, function () {
                storageSandbox.localStorage.key2 = 'value2';
            });
        })
        .then(function (e) {
            checkEventArg(e, 'key2', isIE ? '' : null, 'value2');

            return waitStorageEvent(window, function () {
                storageSandbox.localStorage.key1 = 'value3';
            });
        })
        .then(function (e) {
            checkEventArg(e, 'key1', 'value1', 'value3');

            return waitStorageEvent(window, function () {
                storageSandbox.localStorage.removeItem('key1');
            });
        })
        .then(function (e) {
            checkEventArg(e, 'key1', 'value3', isIE ? 'null' : null);

            start();
        });
});

module('regression');

test("should work with keys named as wrapper's internal members (GH-735)", function () {
    var storageWrapper = storageSandbox.sessionStorage;

    storageWrapper.initialProperties.forEach(function (property) {
        storageWrapper.setItem(property, 'test');

        ok(storageWrapper[property] !== 'test');
        strictEqual(storageWrapper.getItem(property), 'test');
    });

    storageWrapper.wrapperMethods.forEach(function (method) {
        storageWrapper.setItem(method, 'test');

        ok(storageWrapper[method] !== 'test');
        strictEqual(storageWrapper.getItem(method), 'test');
    });
});
