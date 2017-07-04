import SandboxBase from '../base';
import StorageWrapper from './wrapper';
import settings from '../../settings';
import * as destLocation from '../../utils/destination-location';
import * as nativeMethods from '../native-methods';
import { getTopSameDomainWindow } from '../../utils/dom';
import INTERNAL_PROPS from '../../../processing/dom/internal-properties';

const STORAGE_WRAPPER_PREFIX = 'hammerhead|storage-wrapper|';

export default class StorageSandbox extends SandboxBase {
    constructor (listeners, unloadSandbox, eventSimulator) {
        super();

        this.localStorage   = null;
        this.sessionStorage = null;
        this.listeners      = listeners;
        this.unloadSandbox  = unloadSandbox;
        this.eventSimulator = eventSimulator;
        this.storages       = {};
        this.isLocked       = false;
    }

    static _getStorageKey (sessionId, host) {
        return STORAGE_WRAPPER_PREFIX + sessionId + '|' + host;
    }

    _simulateStorageEvent (key, oldValue, newValue, url, storageArea) {
        if (!this.isDeactivated())
            this.eventSimulator.storage(this.window, { key, oldValue, newValue, url, storageArea });
    }

    // NOTE: We are using a single storage wrapper instance for all same-domain windows.
    // This wrapper is saved in the top same-domain window's sandbox.
    _createStorageWrappers () {
        var sessionId             = settings.get().sessionId;
        var host                  = destLocation.getParsed().host;
        var storageKey            = StorageSandbox._getStorageKey(sessionId, host);
        var topSameDomainWindow   = getTopSameDomainWindow(this.window);
        var topSameDomainStorages = topSameDomainWindow[INTERNAL_PROPS.hammerhead].sandbox.storageSandbox.storages;

        // NOTE: Use the already created wrappers.
        if (topSameDomainStorages[storageKey]) {
            this.localStorage   = topSameDomainStorages[storageKey].localStorage;
            this.sessionStorage = topSameDomainStorages[storageKey].sessionStorage;
        }
        // NOTE: Or create new.
        else {
            this.localStorage   = new StorageWrapper(this.window, this.window.localStorage, storageKey);
            this.sessionStorage = new StorageWrapper(this.window, this.window.sessionStorage, storageKey);

            this.unloadSandbox.on(this.unloadSandbox.BEFORE_UNLOAD_EVENT, () => {
                if (!this.isLocked) {
                    this.localStorage.saveToNativeStorage();
                    this.sessionStorage.saveToNativeStorage();
                }
            });

            // NOTE: Push to the top same-domain sandbox.
            topSameDomainStorages[storageKey] = {
                localStorage:   this.localStorage,
                sessionStorage: this.sessionStorage
            };
        }
    }

    _overrideStorageEvent () {
        this.window.StorageEvent = function (type, opts) {
            if (arguments.length === 0)
                throw new TypeError();

            var storedArea = opts.storageArea || null;

            if (storedArea)
                delete opts.storageArea;

            var event = new nativeMethods.StorageEvent(type, opts);

            if (storedArea) {
                Object.defineProperty(event, 'storageArea', {
                    get: () => storedArea,
                    set: () => void 0
                });
            }

            return event;
        };
    }

    clear () {
        this.window.localStorage.removeItem(this.localStorage.nativeStorageKey);
        this.window.sessionStorage.removeItem(this.sessionStorage.nativeStorageKey);
    }

    lock () {
        this.isLocked = true;
    }

    backup () {
        return {
            localStorage:   JSON.stringify(this.localStorage.getCurrentState()),
            sessionStorage: JSON.stringify(this.sessionStorage.getCurrentState())
        };
    }

    restore ({ localStorage, sessionStorage }) {
        this.localStorage.restore(localStorage);
        this.sessionStorage.restore(sessionStorage);
    }

    attach (window) {
        super.attach(window);

        this._createStorageWrappers();

        var storageChanged = (key, oldValue, newValue, url, storage) => {
            if (storage.getContext() !== this.window)
                this._simulateStorageEvent(key, oldValue, newValue, url, storage);
        };

        this.localStorage.on(this.localStorage.STORAGE_CHANGED_EVENT, e =>
            storageChanged(e.key, e.oldValue, e.newValue, e.url, this.localStorage));

        this.sessionStorage.on(this.sessionStorage.STORAGE_CHANGED_EVENT, e =>
            storageChanged(e.key, e.oldValue, e.newValue, e.url, this.sessionStorage));

        this.listeners.initElementListening(window, ['storage']);
        this.listeners.addInternalEventListener(window, ['storage'], (e, dispatched, preventEvent) => {
            if (!dispatched)
                preventEvent();
        });

        this._overrideStorageEvent();
    }
}
