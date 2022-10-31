import StorageWrapper from './wrapper';
import settings from '../../settings';
import * as destLocation from '../../utils/destination-location';
import { getTopSameDomainWindow } from '../../utils/dom';
import getStorageKey from '../../../utils/get-storage-key';
import INTERNAL_PROPS from '../../../processing/dom/internal-properties';
import {
    createOverriddenDescriptor,
    overrideConstructor,
    overrideDescriptor,
    overrideFunction,
} from '../../utils/overriding';
import hammerhead from '../../index';
import UnloadSandbox from '../event/unload';
import nativeMethods from '../native-methods';
import { HammerheadStorageEventInit, StorageProxy } from '../../../typings/client';
import { stringify as stringifyJSON } from '../../../utils/json';

import {
    StorageSandboxFactoryArguments,
    StorageSandboxStrategy,
    StoragesBackup,
} from './interfaces';

const API_KEY_PREFIX = 'hammerhead|api-key-prefix|';
const STORAGE_PROPS  = nativeMethods.arrayConcat.call(nativeMethods.objectKeys(Storage.prototype),
    StorageWrapper.INTERNAL_METHODS);

export class StorageSandboxProxyStrategy implements StorageSandboxStrategy {
    private _window: Window & typeof globalThis | null = null;
    private _unloadSandbox: UnloadSandbox;
    private _localStorageProxy: StorageProxy | null = null;
    private _sessionStorageProxy: StorageProxy | null = null;
    private _intervalId: number | null = null;
    private _isLocked = false;
    private _listeners;
    private _sandbox;
    private _nativeMethods;
    private _eventSimulator;
    private _localStorageChangeHandler: (e: Omit<StorageEventInit, 'storageArea'>) => void;
    private _sessionStorageChangeHandler: (e: Omit<StorageEventInit, 'storageArea'>) => void;

    constructor ({ window, sandbox, nativeMeths, unloadSandbox, listeners, eventSimulator }: StorageSandboxFactoryArguments) {
        this._window = window;
        this._sandbox = sandbox;
        this._nativeMethods = nativeMeths;
        this._unloadSandbox = unloadSandbox;
        this._listeners = listeners;
        this._eventSimulator = eventSimulator;
    }

    get localStorageProxy () {
        return this._localStorageProxy;
    }

    get sessionStorageProxy () {
        return this._sessionStorageProxy;
    }

    backup (): StoragesBackup {
        return {
            localStorage:   stringifyJSON(this._localStorageProxy.unwrapProxy().getCurrentState()),
            sessionStorage: stringifyJSON(this._sessionStorageProxy.unwrapProxy().getCurrentState()),
        };
    }

    clear (): void {
        const localStorageWrapper   = this._localStorageProxy.unwrapProxy();
        const sessionStorageWrapper = this._sessionStorageProxy.unwrapProxy();

        nativeMethods.storageRemoveItem.call(localStorageWrapper.internal.nativeStorage,
            localStorageWrapper.internal.nativeStorageKey);
        nativeMethods.storageRemoveItem.call(sessionStorageWrapper.internal.nativeStorage,
            sessionStorageWrapper.internal.nativeStorageKey);
    }

    dispose (): void {
        this._localStorageProxy.unwrapProxy().removeChangeEventListener(this._localStorageChangeHandler);
        this._sessionStorageProxy.unwrapProxy().removeChangeEventListener(this._sessionStorageChangeHandler);

        const topSameDomainWindow = getTopSameDomainWindow(this._window);

        // NOTE: For removed iframe without src in IE11 window.top equals iframe's window
        if (this._window === topSameDomainWindow && !topSameDomainWindow.frameElement)
            nativeMethods.clearInterval.call(this._window, this._intervalId);
    }

    lock (): void {
        this._isLocked = true;
    }

    unlock (): void {
        this._isLocked = false;
    }

    restore ({ localStorage, sessionStorage }: StoragesBackup) {
        this._localStorageProxy.unwrapProxy().restore(localStorage);
        this._sessionStorageProxy.unwrapProxy().restore(sessionStorage);
    }

    init (): void {
        this._overrideStorageProps();
        this._createStorageWrappers();

        const localStorageWrapper   = this._localStorageProxy.unwrapProxy();
        const sessionStorageWrapper = this._sessionStorageProxy.unwrapProxy();

        this._intervalId = nativeMethods.setInterval.call(this._window, () => {
            localStorageWrapper.checkStorageChanged();
            sessionStorageWrapper.checkStorageChanged();
        }, 10);

        this._localStorageChangeHandler = e => this._simulateStorageEvent(this._localStorageProxy, e);
        this._sessionStorageChangeHandler = e => this._simulateStorageEvent(this._sessionStorageProxy, e);

        localStorageWrapper.addChangeEventListener(this._localStorageChangeHandler);
        sessionStorageWrapper.addChangeEventListener(this._sessionStorageChangeHandler);

        this._listeners.initElementListening(window, ['storage']);
        this._listeners.addInternalEventBeforeListener(window, ['storage'],
            (_, dispatched, preventEvent) => !dispatched && preventEvent());

        this._overrideStorageEvent();
        this._overrideStoragesGetters();
    }

    private _overrideStorageProps () {
        overrideFunction(window.Storage.prototype, 'clear', function (this: StorageProxy) {
            const storage = this.unwrapProxy();

            if (!storage.clearStorage())
                return;

            storage.raiseStorageChanged(null, null, null);
        });

        overrideFunction(window.Storage.prototype, 'getItem', function (this: StorageProxy, key: string) {
            if (arguments.length === 0)
                throw new TypeError(`Failed to execute 'getItem' on 'Storage': 1 argument required, but only 0 present.`);

            const storage  = this.unwrapProxy();
            const validKey = StorageSandboxProxyStrategy._wrapKey(key);

            return nativeMethods.objectHasOwnProperty.call(storage, validKey) ? storage[validKey] : null;
        });

        overrideFunction(window.Storage.prototype, 'key', function (this: StorageProxy, keyNum: number) {
            if (arguments.length === 0)
                throw new TypeError(`TypeError: Failed to execute 'key' on 'Storage': 1 argument required, but only 0 present.`);

            // NOTE: http://w3c-test.org/webstorage/storage_key.html
            keyNum %= 0x100000000;

            if (isNaN(keyNum))
                keyNum = 0;

            const storage         = this.unwrapProxy();
            const addedProperties = nativeMethods.objectKeys(storage);
            const isValidNum      = keyNum >= 0 && keyNum < addedProperties.length;

            return isValidNum ? StorageSandboxProxyStrategy._unwrapKey(addedProperties[keyNum]) : null;
        });

        overrideFunction(window.Storage.prototype, 'removeItem', function (this: StorageProxy, key: string) {
            if (arguments.length === 0)
                throw new TypeError(`Failed to execute 'removeItem' on 'Storage': 1 argument required, but only 0 present.`);

            const storage  = this.unwrapProxy();
            const validKey = StorageSandboxProxyStrategy._wrapKey(key);

            delete storage[validKey];
            storage.checkStorageChanged();
        });

        overrideFunction(window.Storage.prototype, 'setItem', function (this: StorageProxy, key: string, value: string) {
            if (arguments.length < 2)
                throw new TypeError(`Failed to execute 'setItem' on 'Storage': 2 arguments required, but only ${arguments.length} present.`);

            const storage  = this.unwrapProxy();
            const validKey = StorageSandboxProxyStrategy._wrapKey(key);

            storage[validKey] = String(value);
            storage.checkStorageChanged();
        });

        overrideDescriptor(window.Storage.prototype, 'length', {
            getter: function (this: StorageWrapper) {
                return nativeMethods.objectKeys(this).length;
            },
            setter: null,
        });
    }

    // NOTE: We are using a single storage wrapper instance for all same-domain windows.
    // This wrapper is saved in the top same-domain window's sandbox.
    private _createStorageWrappers () {
        // eslint-disable-next-line no-restricted-properties
        const host                        = destLocation.getParsed().host;
        const sessionId                   = settings.get().sessionId;
        const storageKey                  = getStorageKey(sessionId, host);
        const topSameDomainWindow         = getTopSameDomainWindow(this._window);
        const topSameDomainHammerhead     = topSameDomainWindow[INTERNAL_PROPS.hammerhead] as typeof hammerhead;
        const topSameDomainStorageSandbox = topSameDomainHammerhead.sandbox.storageSandbox;

        // NOTE: Use the already created wrappers.
        if (topSameDomainStorageSandbox !== this._sandbox) {
            this._localStorageProxy   = topSameDomainStorageSandbox.localStorageProxy;
            this._sessionStorageProxy = topSameDomainStorageSandbox.sessionStorageProxy;
        }
        // NOTE: Or create new.
        else {
            const nativeLocalStorage   = this._nativeMethods.winLocalStorageGetter.call(this._window);
            const nativeSessionStorage = this._nativeMethods.winSessionStorageGetter.call(this._window);

            this._localStorageProxy   = StorageWrapper.create(this._window, nativeLocalStorage, storageKey);
            this._sessionStorageProxy = StorageWrapper.create(this._window, nativeSessionStorage, storageKey);

            const saveToNativeStorages = () => {
                if (this._isLocked)
                    return;

                this.localStorageProxy.unwrapProxy().saveToNativeStorage();
                this.sessionStorageProxy.unwrapProxy().saveToNativeStorage();
            };

            this._unloadSandbox.on(this._unloadSandbox.UNLOAD_EVENT, saveToNativeStorages);

            // NOTE: In some case, a browser does not emit the onBeforeUnload event and we need manually watch navigation (GH-1999).
            // Also, on iOS devices, we realize the BEFORE_UNLOAD_EVENT through the onPageHide event that browser emits too late
            // and we do not have time to save the localStorage wrapper to the native localStorage (GH-1507).
            hammerhead.pageNavigationWatch.on(hammerhead.pageNavigationWatch.PAGE_NAVIGATION_TRIGGERED_EVENT, saveToNativeStorages);
        }
    }

    private _simulateStorageEvent (storageArea: StorageProxy, e: Omit<StorageEventInit, 'storageArea'>) {
        if (this._sandbox.isDeactivated() || storageArea.unwrapProxy().getContext() === this._window)
            return;

        const event = e as HammerheadStorageEventInit;

        event.storageArea = storageArea;

        this._eventSimulator.storage(this._window, event);
    }

    private _overrideStorageEvent () {
        // NOTE: IE11 has the StorageEvent property, but it is not a constructor
        if (typeof StorageEvent === 'object')
            return;

        overrideConstructor(this._window, 'StorageEvent', function (this: Window, type: string, opts?: StorageEventInit) {
            const storedArea = opts?.storageArea;

            if (storedArea)
                delete opts.storageArea;

            let event: StorageEvent;

            if (arguments.length === 0)
                event = new (nativeMethods.StorageEvent as new () => StorageEvent)();
            else if (arguments.length === 1)
                event = new nativeMethods.StorageEvent(type);
            else
                event = new nativeMethods.StorageEvent(type, opts);

            if (storedArea) {
                nativeMethods.objectDefineProperty(event, 'storageArea', {
                    get: () => storedArea,
                    set: () => void 0,
                });
            }

            return event;
        });
    }

    private _overrideStoragesGetters () {
        const storagesPropsOwner = this._nativeMethods.getStoragesPropsOwner(window);

        // NOTE: Storage properties is located in Window.prototype in the IE11 and these are non configurable.
        // We define descriptors from a prototype with an overridden getter on a window instance.
        // We don't need define descriptors again if these was overridden.
        const shouldDefineStorageProps = !this._nativeMethods.isStoragePropsLocatedInProto ||
            !this._nativeMethods.objectHasOwnProperty.call(window, 'localStorage');

        if (!shouldDefineStorageProps)
            return;

        this._nativeMethods.objectDefineProperties(window, {
            'localStorage': createOverriddenDescriptor(storagesPropsOwner, 'localStorage', {
                // @ts-ignore
                getter: () => {
                    this.localStorageProxy.unwrapProxy().setContext(window);

                    return this.localStorageProxy;
                },
            }),

            'sessionStorage': createOverriddenDescriptor(storagesPropsOwner, 'sessionStorage', {
                // @ts-ignore
                getter: () => {
                    this.sessionStorageProxy.unwrapProxy().setContext(window);

                    return this.sessionStorageProxy;
                },
            }),
        });
    }

    private static _wrapKey (key: string): string {
        const keyStr = String(key);

        return STORAGE_PROPS.indexOf(keyStr) !== -1 ? API_KEY_PREFIX + keyStr : keyStr;
    }

    private static _unwrapKey (key: string): string {
        return key.replace(API_KEY_PREFIX, '');
    }
}

export class StorageSandboxProxylessStrategy implements StorageSandboxStrategy {
    backup (): StoragesBackup {
        return {
            localStorage:   JSON.stringify([Object.keys(localStorage), Object.values(localStorage)]),
            sessionStorage: JSON.stringify([Object.keys(sessionStorage), Object.values(sessionStorage)]),
        };
    }

    clear (): void {
        return void 0;
    }

    dispose (): void {
        return void 0;
    }

    lock (): void {
        return void 0;
    }

    unlock (): void {
        return void 0;
    }

    restore (): StoragesBackup {
        return {
            localStorage:   '',
            sessionStorage: '',
        };
    }

    init (): void {
        return void 0;
    }

    get localStorageProxy () {
        return null;
    }

    get sessionStorageProxy () {
        return null;
    }
}

export class StoragesSandboxStrategyFactory {
    static create (proxyless: boolean, options: StorageSandboxFactoryArguments): StorageSandboxStrategy {
        return proxyless ? new StorageSandboxProxylessStrategy() : new StorageSandboxProxyStrategy(options);
    }
}
