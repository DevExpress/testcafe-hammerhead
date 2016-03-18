import EventEmitter from '../../utils/event-emitter';
import { isIE } from '../../utils/browser';
import * as destLocation from '../../utils/destination-location';
import { isUndefined } from '../../../utils/types';

const STORAGES_SANDBOX_TEMP = 'hammerhead|storeges-sandbox-temp';
const API_KEY_PREFIX        = 'hammerhead|api-key-prefix|';
const KEY                   = 0;
const VALUE                 = 1;

export default class StorageWrapper extends EventEmitter {
    constructor (window, nativeStorage, nativeStorageKey) {
        super();

        this.nativeStorage     = nativeStorage;
        this.nativeStorageKey  = nativeStorageKey;
        this.lastState         = null;
        this.window            = window;
        this.initialProperties = [];
        this.wrapperMethods    = [];

        this.STORAGE_CHANGED_EVENT = 'hammerhead|event|storage-changed';
        this.EMPTY_OLD_VALUE_ARG   = isIE ? '' : null;

        Object.defineProperty(this, 'length', {
            get: () => this._getAddedProperties().length,
            set: () => void 0
        });

        // NOTE: Save wrapper properties and methods to be able to distinguish them from
        // properties that will be created from the outside.
        this.initialProperties = this._getInitialProperties();
        this.wrapperMethods    = StorageWrapper._getWrapperMethods();

        this._init();
    }

    static _getWrapperMethods () {
        var methods = [];

        for (var key in StorageWrapper.prototype)
            methods.push(key);

        return methods;
    }

    _init () {
        this._loadFromNativeStorage();
        this.lastState = this._getCurrentState();

        window.setInterval(() => this._checkStorageChanged(), 10);
    }

    _getInitialProperties () {
        var properties = ['length'];

        for (var property in this) {
            if (this.hasOwnProperty(property))
                properties.push(property);
        }

        return properties;
    }

    _checkStorageChanged () {
        var currentState = this._getCurrentState();

        for (var i = 0; i < this.lastState[KEY].length; i++) {
            var lastStateKey   = this.lastState[KEY][i];
            var lastStateValue = this.lastState[VALUE][i];

            var keyIndex = currentState[KEY].indexOf(lastStateKey);

            if (keyIndex !== -1) {
                if (currentState[VALUE][keyIndex] !== lastStateValue)
                    this._raiseStorageChanged(currentState[KEY][keyIndex], lastStateValue, currentState[VALUE][keyIndex]);

                currentState[KEY].splice(keyIndex, 1);
                currentState[VALUE].splice(keyIndex, 1);
            }
            else
                this._raiseStorageChanged(lastStateKey, lastStateValue, null);
        }

        for (var j = 0; j < currentState[KEY].length; j++)
            this._raiseStorageChanged(currentState[KEY][j], this.EMPTY_OLD_VALUE_ARG, currentState[VALUE][j]);

        this.lastState = this._getCurrentState();
    }

    _getCurrentState () {
        var addedProperties = this._getAddedProperties();
        var state           = [[], []];

        for (var i = 0; i < addedProperties.length; i++) {
            state[KEY].push(addedProperties[i]);
            state[VALUE].push(this[addedProperties[i]]);
        }

        return state;
    }

    _getAddedProperties () {
        var properties = [];

        for (var property in this) {
            if (this.hasOwnProperty(property) && this.initialProperties.indexOf(property) === -1)
                properties.push(property);
        }

        return properties;
    }

    _castToString (value) {
        // NOTE: The browser automatically translates the key and the value to a string. To repeat this behavior,
        // we use native storage:
        // localStorage.setItem(null, null) equivalently to localStorage.setItem('null', 'null')
        this.nativeStorage[STORAGES_SANDBOX_TEMP] = value;

        return this.nativeStorage[STORAGES_SANDBOX_TEMP];
    }

    _raiseStorageChanged (key, oldValue, newValue) {
        var url = destLocation.get();

        this.emit(this.STORAGE_CHANGED_EVENT, { key, oldValue, newValue, url });
    }

    _loadFromNativeStorage () {
        var storage = this.nativeStorage[this.nativeStorageKey];

        storage = JSON.parse(storage || '[[],[]]');

        for (var i = 0; i < storage[KEY].length; i++)
            this[storage[KEY][i]] = storage[VALUE][i];
    }

    _getValidKey (key) {
        var isWrapperMember = this.wrapperMethods.indexOf(name) !== -1 || this.initialProperties.indexOf(name) !== -1;

        key = isWrapperMember ? API_KEY_PREFIX + key : key;

        return this._castToString(key);
    }

    saveToNativeStorage () {
        var state = JSON.stringify(this._getCurrentState());

        if (this.nativeStorage[this.nativeStorageKey] !== state)
            this.nativeStorage[this.nativeStorageKey] = state;
    }

    // API
    clear () {
        var addedProperties = this._getAddedProperties();
        var changed         = false;

        for (var i = 0; i < addedProperties.length; i++) {
            delete this[addedProperties[i]];
            changed = true;
        }

        if (changed) {
            this._raiseStorageChanged(null, null, null);
            this.lastState = this._getCurrentState();
        }
    }

    getItem (key) {
        if (arguments.length === 0)
            throw new TypeError();

        key = this._getValidKey(key);

        return this.hasOwnProperty(key) ? this[key] : null;
    }

    key (keyNum) {
        if (isUndefined(keyNum))
            throw new TypeError();

        // NOTE: http://w3c-test.org/webstorage/storage_key.html
        keyNum %= 0x100000000;

        var addedProperties = this._getAddedProperties();

        return keyNum >= 0 && keyNum < addedProperties.length ? addedProperties[keyNum] : null;
    }

    removeItem (key) {
        if (arguments.length === 0)
            throw new TypeError();

        key = this._getValidKey(key);

        delete this[key];
        this._checkStorageChanged();
    }

    setItem (key, value) {
        if (arguments.length < 2)
            throw new TypeError();

        key   = this._getValidKey(key);
        value = this._castToString(value);

        this[key] = value;
        this._checkStorageChanged();
    }
}
