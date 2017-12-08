import SandboxBase from '../base';
import StorageWrapper from './wrapper';
import settings from '../../settings';
import * as destLocation from '../../utils/destination-location';
import * as nativeMethods from '../native-methods';
import { getTopSameDomainWindow } from '../../utils/dom';
import getStorageKey from '../../../utils/get-storage-key';
import INTERNAL_PROPS from '../../../processing/dom/internal-properties';
import * as JSON from '../../json';

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

    _simulateStorageEventIfNecessary (event, storageArea) {
        if (this.isDeactivated())
            return;

        if (storageArea && storageArea.getContext() !== this.window) {
            event.storageArea = storageArea;
            this.eventSimulator.storage(this.window, event);
        }
    }

    // NOTE: We are using a single storage wrapper instance for all same-domain windows.
    // This wrapper is saved in the top same-domain window's sandbox.
    _createStorageWrappers () {
        const sessionId             = settings.get().sessionId;
        const host                  = destLocation.getParsed().host;
        const storageKey            = getStorageKey(sessionId, host);
        const topSameDomainWindow   = getTopSameDomainWindow(this.window);
        const topSameDomainStorages = topSameDomainWindow[INTERNAL_PROPS.hammerhead].sandbox.storageSandbox.storages;

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
        const win = this.window;

        this.window.StorageEvent = function (type, opts) {
            if (arguments.length === 0)
                throw new TypeError();

            const storedArea = opts.storageArea || null;

            if (storedArea)
                delete opts.storageArea;

            const event = new nativeMethods.StorageEvent(type, opts);

            if (storedArea) {
                nativeMethods.objectDefineProperty.call(win.Object, event, 'storageArea', {
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

        this.localStorage.on(this.localStorage.STORAGE_CHANGED_EVENT, e => this._simulateStorageEventIfNecessary(e, this.localStorage));
        this.sessionStorage.on(this.sessionStorage.STORAGE_CHANGED_EVENT, e => this._simulateStorageEventIfNecessary(e, this.sessionStorage));

        this.listeners.initElementListening(window, ['storage']);
        this.listeners.addInternalEventListener(window, ['storage'], (e, dispatched, preventEvent) => {
            if (!dispatched)
                preventEvent();
        });

        this._overrideStorageEvent();
    }

    dispose () {
        const topSameDomainWindow = getTopSameDomainWindow(this.window);

        // NOTE: For removed iframe without src in IE11 window.top equals iframe's window
        if (this.window === topSameDomainWindow && !topSameDomainWindow.frameElement) {
            this.localStorage.dispose();
            this.sessionStorage.dispose();
        }
        else {
            delete this.localStorage;
            delete this.sessionStorage;
        }
    }
}
