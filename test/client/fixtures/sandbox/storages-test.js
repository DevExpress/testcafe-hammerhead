var StorageWrapper = hammerhead.get('./sandbox/storages/wrapper');
var settings       = hammerhead.get('./settings');

var storageSandbox = hammerhead.sandbox.storageSandbox;
var Promise        = hammerhead.Promise;
var isIE           = hammerhead.utils.browser.isIE;
var nativeMethods  = hammerhead.nativeMethods;

var storageWrapperKey = 'hammerhead|storage-wrapper|' + settings.get().sessionId + '|example.com';

var nativeLocalStorage   = nativeMethods.winLocalStorageGetter.call(window);
var nativeSessionStorage = nativeMethods.winSessionStorageGetter.call(window);

QUnit.testStart(function () {
    // NOTE: Clean up storage wrappers
    nativeLocalStorage.clear();
    nativeSessionStorage.clear();
    localStorage.clear();
    sessionStorage.clear();
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

module('storage sandbox API');

test('clear', function () {
    localStorage.setItem('key11', 'value1');
    sessionStorage.setItem('key12', 'value2');

    strictEqual(localStorage.length, 1);
    strictEqual(sessionStorage.length, 1);
    strictEqual(nativeLocalStorage.getItem(localStorage.nativeStorageKey), null);
    strictEqual(nativeSessionStorage.getItem(sessionStorage.nativeStorageKey), null);

    storageSandbox.unloadSandbox.emit(storageSandbox.unloadSandbox.BEFORE_UNLOAD_EVENT);

    strictEqual(nativeLocalStorage.getItem(localStorage.nativeStorageKey), '[["key11"],["value1"]]');
    strictEqual(nativeSessionStorage.getItem(sessionStorage.nativeStorageKey), '[["key12"],["value2"]]');

    storageSandbox.clear();

    strictEqual(localStorage.length, 1);
    strictEqual(sessionStorage.length, 1);
    strictEqual(nativeLocalStorage.getItem(localStorage.nativeStorageKey), null);
    strictEqual(nativeSessionStorage.getItem(sessionStorage.nativeStorageKey), null);
});

test('lock', function () {
    localStorage.setItem('key11', 'value1');
    sessionStorage.setItem('key12', 'value2');

    strictEqual(localStorage.length, 1);
    strictEqual(sessionStorage.length, 1);
    strictEqual(nativeLocalStorage.getItem(localStorage.nativeStorageKey), null);
    strictEqual(nativeSessionStorage.getItem(sessionStorage.nativeStorageKey), null);

    storageSandbox.lock();
    storageSandbox.unloadSandbox.emit(storageSandbox.unloadSandbox.BEFORE_UNLOAD_EVENT);

    strictEqual(nativeLocalStorage.getItem(localStorage.nativeStorageKey), null);
    strictEqual(nativeSessionStorage.getItem(sessionStorage.nativeStorageKey), null);

    storageSandbox.isLocked = false;
});

test('backup/restore', function () {
    localStorage.setItem('key7', 'value');
    sessionStorage.setItem('key8', 'value');

    var backup = storageSandbox.backup();

    strictEqual(localStorage.length, 1);
    strictEqual(sessionStorage.length, 1);
    strictEqual(backup.localStorage, '[["key7"],["value"]]');
    strictEqual(backup.sessionStorage, '[["key8"],["value"]]');

    localStorage.setItem('key9', 'value');
    sessionStorage.removeItem('key8');

    strictEqual(localStorage.length, 2);
    strictEqual(sessionStorage.length, 0);

    storageSandbox.restore(backup);

    strictEqual(localStorage.length, 1);
    strictEqual(sessionStorage.length, 1);
    strictEqual(localStorage.getItem('key7'), 'value');
    strictEqual(sessionStorage.getItem('key8'), 'value');
});

module('storage API');

test('argument types', function () {
    localStorage.setItem({}, 'value');
    strictEqual(localStorage.getItem({}), 'value');

    localStorage.setItem({}, null);
    strictEqual(localStorage.getItem({}), 'null');

    localStorage.setItem(null, 'value1');
    strictEqual(localStorage.getItem(null), 'value1');
});

test('get item', function () {
    sessionStorage.setItem('key1', 'value1');
    sessionStorage.setItem('key2', 'value2');

    strictEqual(sessionStorage.getItem('key1'), 'value1');
    strictEqual(sessionStorage.getItem('key2'), 'value2');
    strictEqual(sessionStorage.getItem('key3'), null);
});

test('set item', function () {
    localStorage.setItem('key1', 'value1');
    localStorage.setItem('key2', {});

    strictEqual(localStorage.length, 2);
    strictEqual(localStorage.getItem('key1'), 'value1');
    strictEqual(localStorage.getItem('key2'), '[object Object]');

    localStorage.setItem('key1', null);
    localStorage.setItem('key2', 'newValue');

    strictEqual(localStorage.length, 2);
    strictEqual(localStorage.getItem('key1'), 'null');
    strictEqual(localStorage.getItem('key2'), 'newValue');
});

test('get key', function () {
    sessionStorage.setItem('key1', 'value1');
    sessionStorage.setItem('key2', 'value2');

    strictEqual(sessionStorage.length, 2);
    strictEqual(sessionStorage.key(-1), null);
    strictEqual(sessionStorage.key(0), 'key1');
    strictEqual(sessionStorage.key(1), 'key2');
    strictEqual(sessionStorage.key(2), null);
});

test('remove item', function () {
    localStorage.setItem('key1', 'value1');
    localStorage.setItem('key2', 'value2');

    localStorage.removeItem('key3');
    strictEqual(localStorage.length, 2);
    localStorage.removeItem('key1');
    strictEqual(localStorage.length, 1);
    strictEqual(localStorage.getItem('key1'), null);
    strictEqual(localStorage.getItem('key2'), 'value2');
    strictEqual(localStorage.key(0), 'key2');
    strictEqual(localStorage.key(1), null);
});

test('storage length', function () {
    sessionStorage.clear();
    strictEqual(sessionStorage.length, 0);

    sessionStorage.setItem('key1', 'value1');
    strictEqual(sessionStorage.length, 1);

    sessionStorage.setItem('key2', 'value2');
    strictEqual(sessionStorage.length, 2);

    sessionStorage.removeItem('key2');
    strictEqual(sessionStorage.length, 1);

    sessionStorage.clear();
    strictEqual(sessionStorage.length, 0);
});

module('direct record to the storage');

test('setter', function () {
    sessionStorage.key1 = 'value1';
    strictEqual(sessionStorage.getItem('key1'), 'value1');
    strictEqual(sessionStorage.length, 1);

    sessionStorage.key1 = 'newValue';
    strictEqual(sessionStorage.getItem('key1'), 'newValue');
    strictEqual(sessionStorage.length, 1);
});

test('getter', function () {
    localStorage.setItem('key1', 'value1');
    strictEqual(localStorage.key1, 'value1');

    localStorage.setItem('key1', null);
    strictEqual(localStorage.key1, 'null');

    localStorage.setItem(null, null);
    strictEqual(localStorage.null, 'null');

    localStorage.removeItem(null);
    strictEqual(localStorage.null, void 0);
});

module('area of visibility');

test('iframe with empty src', function () {
    localStorage.key1 = 'value1';

    return createTestIframe()
        .then(function (iframe) {
            var iframeLocalStorage = iframe.contentWindow.localStorage;

            strictEqual(iframeLocalStorage.key1, 'value1');

            iframeLocalStorage.key2 = 'value2';
            localStorage.key3    = 'value3';

            strictEqual(localStorage.key2, 'value2');
            strictEqual(iframeLocalStorage.key3, 'value3');
        });
});

module('sync state with native');

test('storages load their state from native', function () {
    nativeLocalStorage[storageWrapperKey]   = '[[ "key1" ],[ "value1" ]]';
    nativeSessionStorage[storageWrapperKey] = '[[ "key2" ],[ "value2" ]]';

    var localSandboxWrapper   = new StorageWrapper(window, nativeLocalStorage, storageWrapperKey, hammerhead.sandbox.event.listeners);
    var sessionSandboxWrapper = new StorageWrapper(window, nativeSessionStorage, storageWrapperKey, hammerhead.sandbox.event.listeners);

    strictEqual(localSandboxWrapper.key1, 'value1');
    strictEqual(sessionSandboxWrapper.key2, 'value2');
});

test('storages save their state on the beforeunload event', function () {
    localStorage.key1   = 'value1';
    sessionStorage.key2 = 'value2';

    ok(!nativeLocalStorage[storageWrapperKey]);
    ok(!nativeSessionStorage[storageWrapperKey]);

    // NOTE: Simulate page leaving
    hammerhead.sandbox.event.unload._emitBeforeUnloadEvent();

    strictEqual(nativeLocalStorage[storageWrapperKey], JSON.stringify([['key1'], ['value1']]));
    strictEqual(nativeSessionStorage[storageWrapperKey], JSON.stringify([['key2'], ['value2']]));
});

module('storage changed event');

test('event firing in all same host windows except current', function () {
    var iframe                 = null;
    var topStorageEventArgs    = [];
    var iframeStorageEventArgs = [];

    var topWindowHandler = function (e) {
        topStorageEventArgs.push(e);
    };

    var iframeWindowHandler = function (e) {
        iframeStorageEventArgs.push(e);
    };

    return createTestIframe()
        .then(function (createdIframe) {
            iframe = createdIframe;

            window.addEventListener('storage', topWindowHandler);
            iframe.contentWindow.addEventListener('storage', iframeWindowHandler);
            iframe.contentWindow.localStorage.key1 = 'value1';

            return waitStorageUpdated();
        })
        .then(function () {
            strictEqual(topStorageEventArgs.length, 1);
            strictEqual(iframeStorageEventArgs.length, 0);

            strictEqual(topStorageEventArgs[0].key, 'key1');
            strictEqual(topStorageEventArgs[0].oldValue, isIE ? '' : null);
            strictEqual(topStorageEventArgs[0].newValue, 'value1');
            strictEqual(topStorageEventArgs[0].url, 'https://example.com/');
            strictEqual(topStorageEventArgs[0].storageArea, iframe.contentWindow.localStorage);

            localStorage.key2 = 'value2';

            return waitStorageUpdated();
        })
        .then(function () {
            strictEqual(topStorageEventArgs.length, 1);
            strictEqual(iframeStorageEventArgs.length, 1);

            strictEqual(iframeStorageEventArgs[0].key, 'key2');
            strictEqual(iframeStorageEventArgs[0].oldValue, isIE ? '' : null);
            strictEqual(iframeStorageEventArgs[0].newValue, 'value2');
            strictEqual(iframeStorageEventArgs[0].url, 'https://example.com/');
            strictEqual(iframeStorageEventArgs[0].storageArea, localStorage);

            window.removeEventListener('storage', topWindowHandler);
        });
});

test('event argument parameters', function () {
    var iframeStorageSandbox = null;
    var checkEventArg        = function (e, key, oldValue, newValue) {
        strictEqual(e.key, key);
        strictEqual(e.oldValue, oldValue);
        strictEqual(e.newValue, newValue);
        strictEqual(e.url, 'https://example.com/');
        strictEqual(e.storageArea, iframeStorageSandbox);
    };

    return createTestIframe()
        .then(function (iframe) {
            iframeStorageSandbox = iframe.contentWindow.localStorage;
            iframeStorageSandbox.clear();

            return waitStorageEvent(window, function () {
                iframeStorageSandbox.key1 = 'value1';
            });
        })
        .then(function (e) {
            checkEventArg(e, 'key1', isIE ? '' : null, 'value1');

            return waitStorageEvent(window, function () {
                iframeStorageSandbox.key2 = 'value2';
            });
        })
        .then(function (e) {
            checkEventArg(e, 'key2', isIE ? '' : null, 'value2');

            return waitStorageEvent(window, function () {
                iframeStorageSandbox.key1 = 'value3';
            });
        })
        .then(function (e) {
            checkEventArg(e, 'key1', 'value1', 'value3');

            return waitStorageEvent(window, function () {
                iframeStorageSandbox.removeItem('key1');
            });
        })
        .then(function (e) {
            checkEventArg(e, 'key1', 'value3', isIE ? 'null' : null);
        });
});

module('regression');

test('Storage wrapper should has Storage prototype (GH-955)', function () {
    Object.defineProperty(window.Storage.prototype, 'gh955', {
        get: function () {
            return 'gh955';
        },
        set: function () {
            return void 0;
        }
    });

    strictEqual(localStorage['gh955'], 'gh955');
    strictEqual(sessionStorage['gh955'], 'gh955');
});

test("should work with keys named as wrapper's internal members (GH-735)", function () {
    sessionStorage.initialProperties.forEach(function (property) {
        sessionStorage.setItem(property, 'test');

        ok(sessionStorage[property] !== 'test');
        strictEqual(sessionStorage.getItem(property), 'test');
    });

    sessionStorage.wrapperMethods.forEach(function (method) {
        sessionStorage.setItem(method, 'test');

        ok(sessionStorage[method] !== 'test');
        strictEqual(sessionStorage.getItem(method), 'test');
    });
});
