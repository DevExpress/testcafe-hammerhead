import EventEmitter from '../../utils/event-emitter';
import { parseProxyUrl } from '../../utils/url';
import * as destLocation from '../../utils/destination-location';
import nativeMethods from '../native-methods';
import { StorageProxy } from '../../../typings/client';
import { parse as parseJSON, stringify as stringifyJSON } from '../../../utils/json';


const STORAGE_WRAPPER_KEY = 'hammerhead|get-storage-wrapper';
const EMPTY_OLD_VALUE_ARG = null;

const storageWrappersInternalInfo = new WeakMap<StorageWrapper, StorageInternalInfo>();

const KEY   = 0;
const VALUE = 1;

type StorageState = [string[], string[]];

interface StorageInternalInfo {
    win: Window;
    ctx: Window;
    lastState: StorageState | null;
    eventEmitter: EventEmitter;
    nativeStorage: Storage;
    nativeStorageKey: string;
}

class StorageInheritor {}

StorageInheritor.prototype = Storage.prototype;

class StorageWrapper extends StorageInheritor {
    static INTERNAL_METHODS: string[];

    private constructor (window: Window, nativeStorage: Storage, nativeStorageKey: string) {
        super();

        storageWrappersInternalInfo.set(this, {
            win:          window,
            ctx:          window,
            lastState:    null,
            eventEmitter: new EventEmitter(),
            nativeStorage, nativeStorageKey,
        });

        this.loadStorage();
    }

    get internal () {
        return storageWrappersInternalInfo.get(this);
    }

    static create (window: Window & typeof globalThis, nativeStorage: Storage, nativeStorageKey: string) {
        const storageWrapper = new StorageWrapper(window, nativeStorage, nativeStorageKey);

        if (!window.Proxy)
            // @ts-ignore
            return storageWrapper as StorageProxy;

        return new nativeMethods.Proxy(storageWrapper, {
            get: (target: StorageWrapper, property: string) => {
                if (property === STORAGE_WRAPPER_KEY)
                    return target;

                return target[property];
            },

            set: (target: StorageWrapper, property: string, value: any) => {
                target['setItem'](property, value);

                return true;
            },

            deleteProperty: (target: StorageWrapper, key: string) => {
                target['removeItem'](key);

                return true;
            },
        }) as StorageProxy;
    }

    setContext (context: Window) {
        this.internal.ctx = context;
    }

    getContext () {
        return this.internal.ctx;
    }

    saveToNativeStorage () {
        const state = stringifyJSON(this.getCurrentState());

        if (this.internal.nativeStorage[this.internal.nativeStorageKey] !== state)
            this.internal.nativeStorage[this.internal.nativeStorageKey] = state;
    }

    getCurrentState (): StorageState {
        const addedProperties = nativeMethods.objectKeys(this);
        const state           = [[], []] as StorageState;

        for (const addedProperty of addedProperties) {
            state[KEY].push(addedProperty);
            state[VALUE].push(this[addedProperty]);
        }

        return state;
    }

    restore (storageStr: string) {
        this.clearStorage();
        this.loadStorage(storageStr);
    }

    clearStorage () {
        const addedProperties = nativeMethods.objectKeys(this);
        let changed           = false;

        for (const addedProperty of addedProperties) {
            delete this[addedProperty];
            changed = true;
        }

        if (changed)
            this.internal.lastState = this.getCurrentState();

        return changed;
    }

    loadStorage (storageStateStr?: string) {
        if (!storageStateStr)
            storageStateStr = this.internal.nativeStorage[this.internal.nativeStorageKey];

        const storageState       = parseJSON(storageStateStr || '[[],[]]') as StorageState;
        const storageStateLength = storageState[KEY].length;

        for (let i = 0; i < storageStateLength; i++)
            this[storageState[KEY][i]] = storageState[VALUE][i];

        this.internal.lastState = storageState;
    }

    raiseStorageChanged (key: string | null, oldValue: string | null, newValue: string | null) {
        let url = null;

        try {
            const parsedContextUrl = parseProxyUrl(this.internal.ctx.location.toString());

            url = parsedContextUrl ? parsedContextUrl.destUrl : destLocation.get();
        }
        catch (e) {
            this.internal.ctx = this.internal.win;

            url = destLocation.get();
        }

        this.internal.eventEmitter.emit('change', { key, oldValue, newValue, url });
    }

    checkStorageChanged () {
        const lastState    = this.internal.lastState;
        const currentState = this.getCurrentState();

        for (let i = 0; i < lastState[KEY].length; i++) {
            const lastStateKey   = lastState[KEY][i];
            const lastStateValue = lastState[VALUE][i];
            const keyIndex       = currentState[KEY].indexOf(lastStateKey);

            if (keyIndex !== -1) {
                if (currentState[VALUE][keyIndex] !== lastStateValue)
                    this.raiseStorageChanged(currentState[KEY][keyIndex], lastStateValue, currentState[VALUE][keyIndex]);

                currentState[KEY].splice(keyIndex, 1);
                currentState[VALUE].splice(keyIndex, 1);
            }
            else
                this.raiseStorageChanged(lastStateKey, lastStateValue, null);
        }

        for (let j = 0; j < currentState[KEY].length; j++)
            this.raiseStorageChanged(currentState[KEY][j], EMPTY_OLD_VALUE_ARG, currentState[VALUE][j]);

        this.internal.lastState = this.getCurrentState();
    }

    addChangeEventListener (fn: (e: Omit<StorageEventInit, 'storageArea'>) => void) {
        this.internal.eventEmitter.on('change', fn);
    }

    removeChangeEventListener (fn: (e: Omit<StorageEventInit, 'storageArea'>) => void) {
        this.internal.eventEmitter.off('change', fn);
    }

    unwrapProxy (): StorageWrapper {
        if (nativeMethods.Proxy) {
            const wrapper = this[STORAGE_WRAPPER_KEY];

            return wrapper || this;
        }

        return this;
    }
}

const ourMethods = nativeMethods.objectKeys(StorageWrapper.prototype);

if (ourMethods.indexOf('internal') === -1)
    ourMethods.push('internal');

for (const method of ourMethods) {
    if (method === 'constructor' || method === 'internal')
        continue;

    nativeMethods.objectDefineProperty(StorageWrapper.prototype, method, {
        value:        StorageWrapper.prototype[method],
        configurable: false,
        enumerable:   false,
        writable:     false,
    });
}

const internalDescriptor = nativeMethods.objectGetOwnPropertyDescriptor(StorageWrapper.prototype, 'internal');

internalDescriptor.configurable = false;
internalDescriptor.enumerable   = false;

nativeMethods.objectDefineProperty(StorageWrapper.prototype, 'internal', internalDescriptor);

nativeMethods.objectDefineProperty(StorageWrapper.prototype, 'constructor',
    nativeMethods.objectGetOwnPropertyDescriptor(Storage.prototype, 'constructor'));

nativeMethods.objectDefineProperty(StorageWrapper, 'INTERNAL_METHODS', { value: ourMethods });

export default StorageWrapper;
