import SandboxBase from '../base';
import StorageWrapper from './wrapper';
import settings from '../../settings';
import * as destLocation from '../../utils/destination-location';
import { getTopSameDomainWindow } from '../../utils/dom';
import getStorageKey from '../../../utils/get-storage-key';
import INTERNAL_PROPS from '../../../processing/dom/internal-properties';
import * as JSON from 'json-hammerhead';
import { createOverriddenDescriptor, overrideDescriptor, overrideFunction } from '../../utils/overriding';
import hammerhead from '../../index';
import Listeners from '../event/listeners';
import UnloadSandbox from '../event/unload';
import EventSimulator from '../event/simulator';
import nativeMethods from '../native-methods';
import { HammerheadStorageEventInit, StorageProxy } from '../../../typings/client';


interface StoragesBackup {
    localStorage: string;
    sessionStorage: string;
}

const API_KEY_PREFIX = 'hammerhead|api-key-prefix|';
const STORAGE_PROPS  = nativeMethods.arrayConcat.call(nativeMethods.objectKeys(Storage.prototype),
    StorageWrapper.HH_INTERNAL_METHODS);

export default class StorageSandbox extends SandboxBase {
    private localStorageProxy: StorageProxy | null = null;
    private sessionStorageProxy: StorageProxy | null = null;
    private intervalId: number | null = null;
    private isLocked = false;
    private localStorageChangeHandler: (e: Omit<StorageEventInit, 'storageArea'>) => void;
    private sessionStorageChangeHandler: (e: Omit<StorageEventInit, 'storageArea'>) => void;

    constructor (private readonly _listeners: Listeners,
        private readonly _unloadSandbox: UnloadSandbox,
        private readonly _eventSimulator: EventSimulator) {
        super();
    }

    private _simulateStorageEvent (storageArea: StorageProxy, e: Omit<StorageEventInit, 'storageArea'>) {
        if (this.isDeactivated() || storageArea.unwrapProxy().getContext() === this.window)
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
        if (topSameDomainStorageSandbox !== this) {
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

    clear () {
        const localStorageWrapper   = this.localStorageProxy.unwrapProxy();
        const sessionStorageWrapper = this.sessionStorageProxy.unwrapProxy();

        nativeMethods.storageRemoveItem.call(localStorageWrapper.internal.nativeStorage,
            localStorageWrapper.internal.nativeStorageKey);
        nativeMethods.storageRemoveItem.call(sessionStorageWrapper.internal.nativeStorage,
            sessionStorageWrapper.internal.nativeStorageKey);
    }

    lock () {
        this.isLocked = true;
    }

    backup (): StoragesBackup {
        return {
            localStorage:   JSON.stringify(this.localStorageProxy.unwrapProxy().getCurrentState()),
            sessionStorage: JSON.stringify(this.sessionStorageProxy.unwrapProxy().getCurrentState())
        };
    }

    restore ({ localStorage, sessionStorage }: StoragesBackup) {
        this.localStorageProxy.unwrapProxy().restore(localStorage);
        this.sessionStorageProxy.unwrapProxy().restore(sessionStorage);
    }

    private _overrideStorageProps () {
        overrideFunction(window.Storage.prototype, 'clear', function (this: StorageProxy) {
            const storage = this.unwrapProxy();

            if (!storage.clearStorage())
                return;

            storage.raiseStorageChanged(null, null, null);
            storage.internal.lastState = storage.getCurrentState();
        });

        overrideFunction(window.Storage.prototype, 'getItem', function (this: StorageProxy, key: string) {
            if (arguments.length === 0)
                throw new TypeError(`Failed to execute 'getItem' on 'Storage': 1 argument required, but only 0 present.`);

            const storage  = this.unwrapProxy();
            const validKey = StorageSandbox._wrapKey(key);

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

            return isValidNum ? StorageSandbox._unwrapKey(addedProperties[keyNum]) : null;
        });

        overrideFunction(window.Storage.prototype, 'removeItem', function (this: StorageProxy, key: string) {
            if (arguments.length === 0)
                throw new TypeError(`Failed to execute 'removeItem' on 'Storage': 1 argument required, but only 0 present.`);

            const storage  = this.unwrapProxy();
            const validKey = StorageSandbox._wrapKey(key);

            delete storage[validKey];
            storage.checkStorageChanged();
        });

        overrideFunction(window.Storage.prototype, 'setItem', function (this: StorageProxy, key: string, value: string) {
            if (arguments.length < 2)
                throw new TypeError(`Failed to execute 'setItem' on 'Storage': 2 arguments required, but only ${arguments.length} present.`);

            const storage  = this.unwrapProxy();
            const validKey = StorageSandbox._wrapKey(key);

            storage[validKey] = String(value);
            storage.checkStorageChanged();
        });

        overrideDescriptor(window.Storage.prototype, 'length', {
            getter: function (this: StorageWrapper) {
                return nativeMethods.objectKeys(this).length
            },
            setter: null
        });
    }

    private _overrideStoragesGetters () {
        const storagesPropsOwner = this.nativeMethods.getStoragesPropsOwner(window);

        // NOTE: Storage properties is located in Window.prototype in the IE11 and these are non configurable.
        // We define descriptors from a prototype with an overridden getter on a window instance.
        // We don't need define descriptors again if these was overridden.
        const shouldDefineStorageProps = !this.nativeMethods.isStoragePropsLocatedInProto ||
            !this.nativeMethods.objectHasOwnProperty.call(window, 'localStorage');

        if (!shouldDefineStorageProps)
            return;

        this.nativeMethods.objectDefineProperties(window, {
            'localStorage': createOverriddenDescriptor(storagesPropsOwner, 'localStorage', {
                // @ts-ignore
                getter: () => {
                    this.localStorageProxy.unwrapProxy().setContext(window);

                    return this.localStorageProxy;
                }
            }),

            'sessionStorage': createOverriddenDescriptor(storagesPropsOwner, 'sessionStorage', {
                // @ts-ignore
                getter: () => {
                    this.sessionStorageProxy.unwrapProxy().setContext(window);

                    return this.sessionStorageProxy;
                }
            })
        });
    }

    private static _wrapKey (key: string): string {
        const keyStr = String(key);

        return STORAGE_PROPS.indexOf(keyStr) !== -1 ? API_KEY_PREFIX + keyStr : keyStr;
    }

    private static _unwrapKey (key: string): string {
        return key.replace(API_KEY_PREFIX, '');
    }

    attach (window: Window & typeof globalThis) {
        super.attach(window);

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

        this._overrideStoragesGetters();
    }

    dispose () {
        this.localStorageProxy.unwrapProxy().removeChangeEventListener(this.localStorageChangeHandler);
        this.sessionStorageProxy.unwrapProxy().removeChangeEventListener(this.sessionStorageChangeHandler);

        const topSameDomainWindow = getTopSameDomainWindow(this.window);

        // NOTE: For removed iframe without src in IE11 window.top equals iframe's window
        if (this.window === topSameDomainWindow && !topSameDomainWindow.frameElement)
            nativeMethods.clearInterval.call(this.window, this.intervalId);
    }
}
