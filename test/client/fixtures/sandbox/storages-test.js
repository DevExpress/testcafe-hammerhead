var StorageWrapper = hammerhead.sandboxUtils.StorageWrapper;
var settings       = hammerhead.settings;

var storageSandbox = hammerhead.sandbox.storageSandbox;
var nativeMethods  = hammerhead.nativeMethods;
var unloadSandbox  = hammerhead.sandbox.event.unload;

var storageWrapperKey = 'hammerhead|storage-wrapper|' + settings.get().sessionId + '|example.com';

var nativeLocalStorage   = nativeMethods.winLocalStorageGetter.call(window);
var nativeSessionStorage = nativeMethods.winSessionStorageGetter.call(window);

// NOTE: Removes the last 'hammerhead|event|unload' listener (() => dispose())
// so that tests don't crash when 'hammerhead|event|unload' is emitted
unloadSandbox.eventsListeners[unloadSandbox.UNLOAD_EVENT].pop();

QUnit.testStart(function () {
    // NOTE: Clean up storage wrappers
    nativeMethods.storageClear.call(nativeLocalStorage);
    nativeMethods.storageClear.call(nativeSessionStorage);
    localStorage.clear();
    sessionStorage.clear();
});

function waitStorageUpdated () {
    return window.wait(100);
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

test('wrapper', function () {
    ok(localStorage instanceof Storage);
    strictEqual(Storage.prototype.setItem.call(localStorage, 'key', 'value'), void 0);
    strictEqual(Storage.prototype.getItem.call(localStorage, 'key'), 'value');
    strictEqual(Storage.prototype.key.call(localStorage, 0), 'key');
    strictEqual(Storage.prototype.removeItem.call(localStorage, 'key'), void 0);
    strictEqual(Storage.prototype.clear.call(localStorage), void 0);
    strictEqual(localStorage.length, 0);

    const nativeStorageKeys = [];
    const storageKeys       = [];

    for (var nativeKey in nativeLocalStorage)
        nativeStorageKeys.push(nativeKey);

    for (var key in localStorage)
        storageKeys.push(key);

    deepEqual(storageKeys, nativeStorageKeys);
});

module('storage sandbox API');

test('clear', function () {
    var nativeLocalStorageKey   = localStorage.internal.nativeStorageKey;
    var nativeSessionStorageKey = sessionStorage.internal.nativeStorageKey;

    localStorage.setItem('key11', 'value1');
    sessionStorage.setItem('key12', 'value2');

    strictEqual(localStorage.length, 1);
    strictEqual(sessionStorage.length, 1);
    strictEqual(nativeMethods.storageGetItem.call(nativeLocalStorage, nativeLocalStorageKey), null);
    strictEqual(nativeMethods.storageGetItem.call(nativeSessionStorage, nativeSessionStorageKey), null);

    unloadSandbox.emit(unloadSandbox.UNLOAD_EVENT);

    strictEqual(nativeMethods.storageGetItem.call(nativeLocalStorage, nativeLocalStorageKey), '[["key11"],["value1"]]');
    strictEqual(nativeMethods.storageGetItem.call(nativeSessionStorage, nativeSessionStorageKey), '[["key12"],["value2"]]');

    storageSandbox.clear();

    strictEqual(localStorage.length, 1);
    strictEqual(sessionStorage.length, 1);
    strictEqual(nativeMethods.storageGetItem.call(nativeLocalStorage, nativeLocalStorageKey), null);
    strictEqual(nativeMethods.storageGetItem.call(nativeSessionStorage, nativeSessionStorageKey), null);
});

test('lock', function () {
    var nativeLocalStorageKey   = localStorage.internal.nativeStorageKey;
    var nativeSessionStorageKey = sessionStorage.internal.nativeStorageKey;

    localStorage.setItem('key11', 'value1');
    sessionStorage.setItem('key12', 'value2');

    strictEqual(localStorage.length, 1);
    strictEqual(sessionStorage.length, 1);
    strictEqual(nativeMethods.storageGetItem.call(nativeLocalStorage, nativeLocalStorageKey), null);
    strictEqual(nativeMethods.storageGetItem.call(nativeSessionStorage, nativeSessionStorageKey), null);

    storageSandbox.lock();
    unloadSandbox.emit(unloadSandbox.UNLOAD_EVENT);

    strictEqual(nativeMethods.storageGetItem.call(nativeLocalStorage, nativeLocalStorageKey), null);
    strictEqual(nativeMethods.storageGetItem.call(nativeSessionStorage, nativeSessionStorageKey), null);

    storageSandbox.strategy.isLocked = false;
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

if (window.Proxy) {
    test('convert value type on setter', function () {
        sessionStorage.key1 = 111;
        strictEqual(sessionStorage.getItem('key1'), '111');
        strictEqual(sessionStorage.length, 1);

        sessionStorage.key1 = 222;
        strictEqual(sessionStorage.getItem('key1'), '222');
        strictEqual(sessionStorage.length, 1);

        sessionStorage.unwrapProxy = 333;
        sessionStorage.internal = 444;
        strictEqual(sessionStorage.getItem('unwrapProxy'), '333');
        strictEqual(sessionStorage.unwrapProxy()['hammerhead|api-key-prefix|unwrapProxy'], '333');
        strictEqual(sessionStorage.getItem('internal'), '444');
        strictEqual(sessionStorage.unwrapProxy()['hammerhead|api-key-prefix|internal'], '444');
        strictEqual(sessionStorage.length, 3);
    });

    test('clear storage via delete properties', function () {
        sessionStorage.key1 = 'value1';
        strictEqual(sessionStorage.getItem('key1'), 'value1');
        strictEqual(sessionStorage.length, 1);

        sessionStorage.key2 = 'value2';
        strictEqual(sessionStorage.getItem('key2'), 'value2');
        strictEqual(sessionStorage.length, 2);

        var previousKeyCount = Object.keys(sessionStorage).length;

        for (var key in sessionStorage)
            delete sessionStorage[key];

        var currentKeyCount = Object.keys(sessionStorage).length;
        var deletedKeyCount = 2;

        strictEqual(currentKeyCount, previousKeyCount - deletedKeyCount);
        strictEqual(sessionStorage.getItem('key1'), null);
        strictEqual(sessionStorage.getItem('key2'), null);
        strictEqual(sessionStorage.length, 0);
    });

    test('should not throw an error when deletion occurs on a property that does not exist (GH-2504)', function () {
        strictEqual(localStorage.getItem('key2504'), null);
        strictEqual(delete localStorage.key2504, true);
        strictEqual(nativeMethods.storageGetItem.call(nativeLocalStorage, 'key2504'), null);
        strictEqual(delete nativeLocalStorage.key2504, true);
    });
}

module('area of visibility');

test('iframe with empty src', function () {
    localStorage.key1 = 'value1';

    return createTestIframe()
        .then(function (iframe) {
            var iframeLocalStorage = iframe.contentWindow.localStorage;

            strictEqual(iframeLocalStorage.key1, 'value1');

            iframeLocalStorage.key2 = 'value2';
            localStorage.key3       = 'value3';

            strictEqual(localStorage.key2, 'value2');
            strictEqual(iframeLocalStorage.key3, 'value3');
        });
});

module('sync state with native');

test('storages load their state from native', function () {
    nativeLocalStorage[storageWrapperKey]   = '[[ "key1" ],[ "value1" ]]';
    nativeSessionStorage[storageWrapperKey] = '[[ "key2" ],[ "value2" ]]';

    var localSandboxWrapper   = new StorageWrapper(window, nativeLocalStorage, storageWrapperKey);
    var sessionSandboxWrapper = new StorageWrapper(window, nativeSessionStorage, storageWrapperKey);

    strictEqual(localSandboxWrapper.key1, 'value1');
    strictEqual(sessionSandboxWrapper.key2, 'value2');
});

test('storages save their state on the unload event', function () {
    localStorage.key1   = 'value1';
    sessionStorage.key2 = 'value2';

    ok(!nativeLocalStorage[storageWrapperKey]);
    ok(!nativeSessionStorage[storageWrapperKey]);

    // NOTE: Simulate page leaving
    unloadSandbox._emitEvent(unloadSandbox.unloadProperties);

    strictEqual(nativeLocalStorage[storageWrapperKey], JSON.stringify([['key1'], ['value1']]));
    strictEqual(nativeSessionStorage[storageWrapperKey], JSON.stringify([['key2'], ['value2']]));
});

module('storage changed event');

test('event firing in all same host windows except current', function () {
    var iframe                 = null;
    var topStorageEventArgs    = [];
    var iframeStorageEventArgs = [];
    var topWindowHandler       = function (e) {
        topStorageEventArgs.push(e);
    };
    var iframeWindowHandler    = function (e) {
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
            strictEqual(topStorageEventArgs[0].oldValue, null);
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
            strictEqual(iframeStorageEventArgs[0].oldValue, null);
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
            checkEventArg(e, 'key1', null, 'value1');

            return waitStorageEvent(window, function () {
                iframeStorageSandbox.key2 = 'value2';
            });
        })
        .then(function (e) {
            checkEventArg(e, 'key2', null, 'value2');

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
            checkEventArg(e, 'key1', 'value3', null);
        });
});

if (typeof StorageEvent !== 'object') {
    test('the StorageEvent constructor should not throw an error', function () {
        var event = new StorageEvent('storage', {
            key:         'test_key',
            newValue:    'test_value',
            oldValue:    'value',
            url:         'http://example.com',
            storageArea: localStorage,
        });

        strictEqual(event.key, 'test_key');
        strictEqual(event.newValue, 'test_value');
        strictEqual(event.oldValue, 'value');
        strictEqual(event.url, 'http://example.com');
        strictEqual(event.storageArea, localStorage);
    });
}

module('regression');

test('Storage wrapper should has Storage prototype (GH-955)', function () {
    Object.defineProperty(window.Storage.prototype, 'gh955', {
        get: function () {
            return 'gh955';
        },
    });

    strictEqual(localStorage['gh955'], 'gh955');
    strictEqual(sessionStorage['gh955'], 'gh955');
});

test("should work with keys named as wrapper's internal members (GH-735)", function () {
    var internalProps = nativeMethods.objectKeys(Storage.prototype).concat(StorageWrapper.INTERNAL_METHODS);

    internalProps.forEach(function (property) {
        sessionStorage.setItem(property, 'test1');

        notEqual(sessionStorage[property], 'test1');
        strictEqual(sessionStorage.getItem(property), 'test1');

        localStorage[property] = 'test2';

        notEqual(localStorage[property], 'test2');
        strictEqual(localStorage.getItem(property), 'test2');
    });
});

test('localStorage should be saved after location.replace (GH-1999)', function () {
    var event = null;

    window.addEventListener('message', function (e) {
        event = e;
    });

    return createTestIframe({ src: getCrossDomainPageUrl('../../data/storages/location-replace.html') })
        .then(function () {
            return window.QUnitGlobals.wait(function () {
                return event !== null;
            });
        })
        .then(function () {
            strictEqual(event.data, 'data');
        });
});

test('Storages are saved on the unload event (GH-4834)', function () {
    var event        = null;
    var iframeWindow = null;

    window.addEventListener('message', function (e) {
        event = e;
    });

    return createTestIframe({ src: getSameDomainPageUrl('../../data/storages/update-storages-on-unload.html') })
        .then(function (iframe) {
            iframeWindow = iframe.contentWindow;

            strictEqual(iframeWindow.sessionStorage.getItem('item'), 'value');
            strictEqual(iframeWindow.localStorage.getItem('item'), 'value');

            iframeWindow.location.href = getSameDomainPageUrl('../../data/storages/update-storages-result.html');

            return window.QUnitGlobals.wait(function () {
                return event !== null;
            });
        })
        .then(function () {
            strictEqual(iframeWindow.sessionStorage.getItem('item'), null);
            strictEqual(iframeWindow.localStorage.getItem('item'), null);
        });
});
