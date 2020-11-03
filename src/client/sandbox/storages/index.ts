import SandboxBase from '../base';
import StorageWrapper from './wrapper';
import settings from '../../settings';
import * as destLocation from '../../utils/destination-location';
import { getTopSameDomainWindow } from '../../utils/dom';
import getStorageKey from '../../../utils/get-storage-key';
import INTERNAL_PROPS from '../../../processing/dom/internal-properties';
import * as JSON from 'json-hammerhead';
import { createOverriddenDescriptor } from '../../utils/overriding';
import hammerhead from '../../index';
import Listeners from '../event/listeners';
import UnloadSandbox from '../event/unload';
import EventSimulator from '../event/simulator';

const STORAGE_ACCESS_DENIED_ERROR_CODE = 18;

export default class StorageSandbox extends SandboxBase {
    localStorageWrapper: StorageWrapper;
    sessionStorageWrapper: StorageWrapper;
    storages: any;
    isLocked: boolean;
    onLocalStorageChangeListener: any;
    onSessionStorageListener: any;

    constructor (private readonly _listeners: Listeners,
        private readonly _unloadSandbox: UnloadSandbox,
        private readonly _eventSimulator: EventSimulator) {
        super();

        this.localStorageWrapper   = null;
        this.sessionStorageWrapper = null;
        this.storages              = {};
        this.isLocked              = false;
    }

    _simulateStorageEventIfNecessary (event, storageArea) {
        if (this.isDeactivated())
            return;

        if (storageArea && storageArea.getContext() !== this.window) {
            event.storageArea = storageArea;
            this._eventSimulator.storage(this.window, event);
        }
    }

    // NOTE: We are using a single storage wrapper instance for all same-domain windows.
    // This wrapper is saved in the top same-domain window's sandbox.
    _createStorageWrappers () {
        // eslint-disable-next-line no-restricted-properties
        const host = destLocation.getParsed().host;

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
            // @ts-ignore
            this.localStorageWrapper   = new StorageWrapper(this.window, this.nativeMethods.winLocalStorageGetter.call(this.window), storageKey);
            // @ts-ignore
            this.sessionStorageWrapper = new StorageWrapper(this.window, this.nativeMethods.winSessionStorageGetter.call(this.window), storageKey);

            const saveToNativeStorages = () => {
                try {
                    if (!this.isLocked) {
                        this.localStorageWrapper.saveToNativeStorage();
                        this.sessionStorageWrapper.saveToNativeStorage();
                    }
                }
                catch (e) {
                    if (e.code !== STORAGE_ACCESS_DENIED_ERROR_CODE)
                        throw e;
                }
            };

            this._unloadSandbox.on(this._unloadSandbox.BEFORE_UNLOAD_EVENT, saveToNativeStorages);
            this._unloadSandbox.on(this._unloadSandbox.UNLOAD_EVENT, saveToNativeStorages);

            // NOTE: In some case, a browser does not emit the onBeforeUnload event and we need manually watch navigation (GH-1999).
            // Also, on iOS devices, we realize the BEFORE_UNLOAD_EVENT through the onPageHide event that browser emits too late
            // and we do not have time to save the localStorage wrapper to the native localStorage (GH-1507).
            hammerhead.pageNavigationWatch.on(hammerhead.pageNavigationWatch.PAGE_NAVIGATION_TRIGGERED_EVENT, saveToNativeStorages);

            // NOTE: Push to the top same-domain sandbox.
            topSameDomainStorages[storageKey] = {
                localStorageWrapper:   this.localStorageWrapper,
                sessionStorageWrapper: this.sessionStorageWrapper
            };
        }
    }

    _overrideStorageEvent () {
        // @ts-ignore
        this.window.StorageEvent = function (type, opts) {
            if (arguments.length === 0)
                throw new TypeError();

            const storedArea = opts.storageArea || null;

            if (storedArea)
                delete opts.storageArea;

            const event = new this.nativeMethods.StorageEvent(type, opts);

            if (storedArea) {
                this.nativeMethods.objectDefineProperty(event, 'storageArea', {
                    get: () => storedArea,
                    set: () => void 0
                });
            }

            return event;
        };

        // @ts-ignore
        window.StorageEvent.toString = () => this.nativeMethods.StorageEvent.toString();
    }

    clear () {
        this.nativeMethods.winLocalStorageGetter.call(this.window).removeItem(this.localStorageWrapper.nativeStorageKey);
        this.nativeMethods.winSessionStorageGetter.call(this.window).removeItem(this.sessionStorageWrapper.nativeStorageKey);
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

        this._listeners.initElementListening(window, ['storage']);
        this._listeners.addInternalEventListener(window, ['storage'], (_e, dispatched, preventEvent) => {
            if (!dispatched)
                preventEvent();
        });

        this._overrideStorageEvent();

        const storagesPropsOwner = this.nativeMethods.getStoragesPropsOwner(window);

        // NOTE: Storage properties is located in Window.prototype in the IE11 and these are non configurable.
        // We define descriptors from a prototype with an overridden getter on a window instance.
        // We don't need define descriptors again if these was overridden.
        const shouldDefineStorageProps = !this.nativeMethods.isStoragePropsLocatedInProto ||
                                         !this.nativeMethods.objectHasOwnProperty.call(window, 'localStorage');

        if (shouldDefineStorageProps) {
            this.nativeMethods.objectDefineProperties(window, {
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
