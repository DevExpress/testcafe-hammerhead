import SandboxBase from '../base';
import StorageWrapper from './wrapper';
import settings from '../../settings';
import * as destLocation from '../../utils/destination-location';
import * as nativeMethods from '../native-methods';
import { getTopSameDomainWindow } from '../../utils/dom';
import getStorageKey from '../../../utils/get-storage-key';
import INTERNAL_PROPS from '../../../processing/dom/internal-properties';
import * as JSON from '../../json';
import { createOverriddenDescriptor } from '../../utils/property-overriding';

export default class StorageSandbox extends SandboxBase {
    constructor (listeners, unloadSandbox, eventSimulator) {
        super();

        this.localStorageWrapper   = null;
        this.sessionStorageWrapper = null;
        this.listeners             = listeners;
        this.unloadSandbox         = unloadSandbox;
        this.eventSimulator        = eventSimulator;
        this.storages              = {};
        this.isLocked              = false;
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
        /*eslint-disable no-restricted-properties*/
        const host = destLocation.getParsed().host;
        /*eslint-enable no-restricted-properties*/

        const sessionId             = settings.get().sessionId;
        const storageKey            = getStorageKey(sessionId, host);
        const topSameDomainWindow   = getTopSameDomainWindow(this.window);
        const topSameDomainStorages = topSameDomainWindow[INTERNAL_PROPS.hammerhead].sandbox.storageSandbox.storages;

        // NOTE: Use the already created wrappers.
        if (topSameDomainStorages[storageKey]) {
            this.localStorageWrapper   = topSameDomainStorages[storageKey].localStorageWrapper;
            this.sessionStorageWrapper = topSameDomainStorages[storageKey].sessionStorageWrapper;
        }
        // NOTE: Or create new.
        else {
            this.localStorageWrapper   = new StorageWrapper(this.window, nativeMethods.winLocalStorageGetter.call(this.window), storageKey);
            this.sessionStorageWrapper = new StorageWrapper(this.window, nativeMethods.winSessionStorageGetter.call(this.window), storageKey);

            this.unloadSandbox.on(this.unloadSandbox.BEFORE_UNLOAD_EVENT, () => {
                if (!this.isLocked) {
                    this.localStorageWrapper.saveToNativeStorage();
                    this.sessionStorageWrapper.saveToNativeStorage();
                }
            });

            // NOTE: Push to the top same-domain sandbox.
            topSameDomainStorages[storageKey] = {
                localStorageWrapper:   this.localStorageWrapper,
                sessionStorageWrapper: this.sessionStorageWrapper
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
        nativeMethods.winLocalStorageGetter.call(this.window).removeItem(this.localStorageWrapper.nativeStorageKey);
        nativeMethods.winSessionStorageGetter.call(this.window).removeItem(this.sessionStorageWrapper.nativeStorageKey);
    }

    lock () {
        this.isLocked = true;
    }

    backup () {
        return {
            localStorage:   JSON.stringify(this.localStorageWrapper.getCurrentState()),
            sessionStorage: JSON.stringify(this.sessionStorageWrapper.getCurrentState())
        };
    }

    restore ({ localStorage, sessionStorage }) {
        this.localStorageWrapper.restore(localStorage);
        this.sessionStorageWrapper.restore(sessionStorage);
    }

    attach (window) {
        super.attach(window);

        this._createStorageWrappers();

        this.onLocalStorageChangeListener = this.localStorageWrapper.on(this.localStorageWrapper.STORAGE_CHANGED_EVENT,
            e => this._simulateStorageEventIfNecessary(e, this.localStorageWrapper));
        this.onSessionStorageListener     = this.sessionStorageWrapper.on(this.sessionStorageWrapper.STORAGE_CHANGED_EVENT,
            e => this._simulateStorageEventIfNecessary(e, this.sessionStorageWrapper));

        this.listeners.initElementListening(window, ['storage']);
        this.listeners.addInternalEventListener(window, ['storage'], (e, dispatched, preventEvent) => {
            if (!dispatched)
                preventEvent();
        });

        this._overrideStorageEvent();

        const storagesPropsOwner = this.nativeMethods.getStoragesPropsOwner(window);

        if (!nativeMethods.isStoragesPropsLocatedInProto || !window.hasOwnProperty('localStorage')) {
            nativeMethods.objectDefineProperties.call(window.Object, window, {
                'localStorage': createOverriddenDescriptor(storagesPropsOwner, 'localStorage', {
                    getter: () => {
                        this.localStorageWrapper.setContext(window);

                        return this.localStorageWrapper;
                    }
                }),

                'sessionStorage': createOverriddenDescriptor(storagesPropsOwner, 'sessionStorage', {
                    getter: () => {
                        this.sessionStorageWrapper.setContext(window);

                        return this.sessionStorageWrapper;
                    }
                })
            });
        }
    }

    dispose () {
        this.localStorageWrapper.off(this.localStorageWrapper.STORAGE_CHANGED_EVENT, this.onLocalStorageChangeListener);
        this.sessionStorageWrapper.off(this.sessionStorageWrapper.STORAGE_CHANGED_EVENT, this.onSessionStorageListener);

        const topSameDomainWindow = getTopSameDomainWindow(this.window);

        // NOTE: For removed iframe without src in IE11 window.top equals iframe's window
        if (this.window === topSameDomainWindow && !topSameDomainWindow.frameElement) {
            this.localStorageWrapper.dispose();
            this.sessionStorageWrapper.dispose();
        }
    }
}
