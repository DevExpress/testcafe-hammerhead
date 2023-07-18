import SandboxBase from '../base';
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
import Listeners from '../event/listeners';
import UnloadSandbox from '../event/unload';
import EventSimulator from '../event/simulator';
import nativeMethods from '../native-methods';
import { HammerheadStorageEventInit, StorageProxy } from '../../../typings/client';
import { stringify as stringifyJSON } from '../../../utils/json';


interface StoragesBackup {
    localStorage: string;
    sessionStorage: string;
}

const API_KEY_PREFIX = 'hammerhead|api-key-prefix|';
const STORAGE_PROPS  = nativeMethods.arrayConcat.call(nativeMethods.objectKeys(Storage.prototype),
    StorageWrapper.INTERNAL_METHODS);

interface StorageSandboxStrategy {
    localStorageProxy: StorageProxy | null;
    sessionStorageProxy: StorageProxy | null;

    attach (window: Window & typeof globalThis): void;

    lock (): void;

    dispose (): void;

    clear (): void;

    restore (storagesBackup: StoragesBackup): void;

    backup (): StoragesBackup;
}

class StorageSandboxStrategyBase {
    localStorageProxy: StorageProxy | null;
    sessionStorageProxy: StorageProxy | null;
}

class StorageSandboxNativeAutomationStrategy extends StorageSandboxStrategyBase implements StorageSandboxStrategy {
    backup (): StoragesBackup {
        return {
            localStorage:   stringifyJSON(this._getStorageKeysAndValues(localStorage)),
            sessionStorage: stringifyJSON(this._getStorageKeysAndValues(sessionStorage)),
        };
    }

    attach (): void {
        return void 0;
    }

    lock (): void {
        return void 0;
    }

    dispose (): void {
        return void 0;
    }

    clear (): void {
        return void 0;
    }

    restore (): void {
        return void 0;
    }

    _getStorageKeysAndValues (storage): string[][] {
        const storageKeys   = nativeMethods.objectKeys(storage);
        const storageValues = [];

        for (const key of storageKeys)
            storageValues.push(storage[key]);

        return [storageKeys, storageValues];
    }
}

class StorageSandboxProxyStrategy extends StorageSandboxStrategyBase implements StorageSandboxStrategy {
    private readonly sandbox: StorageSandbox;
    private readonly window: Window & typeof globalThis | null = null;
    private _listeners: Listeners;
    private nativeMethods = nativeMethods;
    private document: Document | null = null;

    private intervalId: number | null = null;
    private isLocked = false;
    private localStorageChangeHandler: (e: Omit<StorageEventInit, 'storageArea'>) => void;
    private sessionStorageChangeHandler: (e: Omit<StorageEventInit, 'storageArea'>) => void;
    private _eventSimulator: EventSimulator;
    private _unloadSandbox: UnloadSandbox;

    constructor (sandbox: StorageSandbox,
        window: Window & typeof globalThis | null,
        listeners: Listeners,
        eventSimulator: EventSimulator,
        unloadSandbox: UnloadSandbox,
    ) {
        super();

        this.sandbox = sandbox;
        this.window = window;
        this._listeners = listeners;
        this._eventSimulator = eventSimulator;
        this._unloadSandbox = unloadSandbox;
    }

    backup () {
        return {
            localStorage:   stringifyJSON(this.localStorageProxy.unwrapProxy().getCurrentState()),
            sessionStorage: stringifyJSON(this.sessionStorageProxy.unwrapProxy().getCurrentState()),
        };
    }

    restore ({ localStorage, sessionStorage }: StoragesBackup): void {
        this.localStorageProxy.unwrapProxy().restore(localStorage);
        this.sessionStorageProxy.unwrapProxy().restore(sessionStorage);
    }

    public attach (window: Window & typeof globalThis) {
        this._overrideStorageProps();
        this._createStorageWrappers();

        const localStorageWrapper   = this.localStorageProxy.unwrapProxy();
        const sessionStorageWrapper = this.sessionStorageProxy.unwrapProxy();

        this.intervalId = nativeMethods.setInterval.call(this.window, () => {
            localStorageWrapper.checkStorageChanged();
            sessionStorageWrapper.checkStorageChanged();
        }, 10);

        this.localStorageChangeHandler = e => this._simulateStorageEvent(this.localStorageProxy, e);
        this.sessionStorageChangeHandler = e => this._simulateStorageEvent(this.sessionStorageProxy, e);

        localStorageWrapper.addChangeEventListener(this.localStorageChangeHandler);
        sessionStorageWrapper.addChangeEventListener(this.sessionStorageChangeHandler);

        this._listeners.initElementListening(window, ['storage']);
        this._listeners.addInternalEventBeforeListener(window, ['storage'],
            (_, dispatched, preventEvent) => !dispatched && preventEvent());

        this._overrideStorageEvent();
        this._overrideStoragesGetters();
    }

    clear () {
        const localStorageWrapper   = this.localStorageProxy.unwrapProxy();
        const sessionStorageWrapper = this.sessionStorageProxy.unwrapProxy();

        nativeMethods.storageRemoveItem.call(localStorageWrapper.internal.nativeStorage,
            localStorageWrapper.internal.nativeStorageKey);
        nativeMethods.storageRemoveItem.call(sessionStorageWrapper.internal.nativeStorage,
            sessionStorageWrapper.internal.nativeStorageKey);
    }

    dispose () {
        this.localStorageProxy.unwrapProxy().removeChangeEventListener(this.localStorageChangeHandler);
        this.sessionStorageProxy.unwrapProxy().removeChangeEventListener(this.sessionStorageChangeHandler);

        nativeMethods.clearInterval.call(this.window, this.intervalId);
    }

    private static _wrapKey (key: string): string {
        const keyStr = String(key);

        return STORAGE_PROPS.indexOf(keyStr) !== -1 ? API_KEY_PREFIX + keyStr : keyStr;
    }

    private static _unwrapKey (key: string): string {
        return key.replace(API_KEY_PREFIX, '');
    }

    private _simulateStorageEvent (storageArea: StorageProxy, e: Omit<StorageEventInit, 'storageArea'>) {
        if (this.sandbox.isDeactivated() || storageArea.unwrapProxy().getContext() === this.window)
            return;

        const event = e as HammerheadStorageEventInit;

        event.storageArea = storageArea;

        this._eventSimulator.storage(this.window, event);
    }

    // NOTE: We are using a single storage wrapper instance for all same-domain windows.
    // This wrapper is saved in the top same-domain window's sandbox.
    private _createStorageWrappers () {
        // eslint-disable-next-line no-restricted-properties
        const host                        = destLocation.getParsed().host;
        const sessionId                   = settings.get().sessionId;
        const storageKey                  = getStorageKey(sessionId, host);
        const topSameDomainWindow         = getTopSameDomainWindow(this.window);
        const topSameDomainHammerhead     = topSameDomainWindow[INTERNAL_PROPS.hammerhead] as typeof hammerhead;
        const topSameDomainStorageSandbox = topSameDomainHammerhead.sandbox.storageSandbox;

        // NOTE: Use the already created wrappers.
        if (topSameDomainStorageSandbox !== this.sandbox) {
            this.localStorageProxy   = topSameDomainStorageSandbox.localStorageProxy;
            this.sessionStorageProxy = topSameDomainStorageSandbox.sessionStorageProxy;
        }
        // NOTE: Or create new.
        else {
            const nativeLocalStorage   = this.nativeMethods.winLocalStorageGetter.call(this.window);
            const nativeSessionStorage = this.nativeMethods.winSessionStorageGetter.call(this.window);

            this.localStorageProxy   = StorageWrapper.create(this.window, nativeLocalStorage, storageKey);
            this.sessionStorageProxy = StorageWrapper.create(this.window, nativeSessionStorage, storageKey);

            const saveToNativeStorages = () => {
                if (this.isLocked)
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

    private _overrideStorageEvent () {
        overrideConstructor(this.window, 'StorageEvent', function (this: Window, type: string, opts?: StorageEventInit) {
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

    private _overrideStoragesGetters () {
        this.nativeMethods.objectDefineProperties(window, {
            'localStorage': createOverriddenDescriptor(window, 'localStorage', {
                // @ts-ignore
                getter: () => {
                    this.localStorageProxy.unwrapProxy().setContext(window);

                    return this.localStorageProxy;
                },
            }),

            'sessionStorage': createOverriddenDescriptor(window, 'sessionStorage', {
                // @ts-ignore
                getter: () => {
                    this.sessionStorageProxy.unwrapProxy().setContext(window);

                    return this.sessionStorageProxy;
                },
            }),
        });
    }

    lock (): void {
        this.isLocked = true;
    }
}

export default class StorageSandbox extends SandboxBase {
    private strategy: StorageSandboxStrategy;

    constructor (private readonly _listeners: Listeners,
        private readonly _unloadSandbox: UnloadSandbox,
        private readonly _eventSimulator: EventSimulator) {
        super();
    }

    get localStorageProxy (): StorageProxy | null {
        return this.strategy.localStorageProxy;
    }

    get sessionStorageProxy (): StorageProxy | null {
        return this.strategy.sessionStorageProxy;
    }

    clear () {
        this.strategy.clear();
    }

    lock () {
        this.strategy.lock();
    }

    backup (): StoragesBackup {
        return this.strategy.backup();
    }

    restore (storagesBackup: StoragesBackup) {
        this.strategy.restore(storagesBackup);
    }

    attach (window: Window & typeof globalThis) {
        super.attach(window);

        this.strategy = settings.nativeAutomation ? new StorageSandboxNativeAutomationStrategy() : new StorageSandboxProxyStrategy(
            this,
            window,
            this._listeners,
            this._eventSimulator,
            this._unloadSandbox,
        );

        this.strategy.attach(window);
    }

    dispose () {
        this.strategy.dispose();
    }
}
