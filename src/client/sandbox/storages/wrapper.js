import EventEmitter from '../../utils/event-emitter';
import { isIE } from '../../utils/browser';
import { parseProxyUrl } from '../../utils/url';
import * as destLocation from '../../utils/destination-location';

const STORAGES_SANDBOX_TEMP = 'hammerhead|storages-sandbox-temp';
const API_KEY_PREFIX        = 'hammerhead|api-key-prefix|';
const KEY                   = 0;
const VALUE                 = 1;

function getWrapperMethods () {
    var methods = [];

    for (var key in StorageWrapper.prototype)
        methods.push(key);

    return methods;
}

export default function StorageWrapper (window, nativeStorage, nativeStorageKey) {
    this.eventEmitter      = new EventEmitter();
    this.on                = (ev, handler) => this.eventEmitter.on(ev, handler);
    this.emit              = (ev, e) => this.eventEmitter.emit(ev, e);
    this.nativeStorage     = nativeStorage;
    this.nativeStorageKey  = nativeStorageKey;
    this.lastState         = null;
    this.window            = window;
    this.initialProperties = [];
    this.wrapperMethods    = [];
    this.context           = window;

    this.STORAGE_CHANGED_EVENT = 'hammerhead|event|storage-changed';
    this.EMPTY_OLD_VALUE_ARG   = isIE ? '' : null;

    var getAddedProperties = () => {
        // NOTE: The standard doesn't regulate the order in which properties are enumerated.
        // But we rely on the fact that they are enumerated in the order they were created in all the supported browsers.
        // In this case we cannot use Object.getOwnPropertyNames
        // because the enumeration order in Android 5.1 is different from all other browsers.
        var properties = [];

        for (var property in this) {
            if (this.hasOwnProperty(property) && this.initialProperties.indexOf(property) === -1)
                properties.push(property);
        }

        return properties;
    };

    Object.defineProperty(this, 'length', {
        get: () => getAddedProperties().length,
        set: () => void 0
    });

    var loadFromNativeStorage = () => {
        var storage = this.nativeStorage[this.nativeStorageKey];

        storage = JSON.parse(storage || '[[],[]]');

        for (var i = 0; i < storage[KEY].length; i++)
            this[storage[KEY][i]] = storage[VALUE][i];
    };

    var getCurrentState = () => {
        var addedProperties = getAddedProperties();
        var state           = [[], []];

        for (var addedProperty of addedProperties) {
            state[KEY].push(addedProperty);
            state[VALUE].push(this[addedProperty]);
        }

        return state;
    };

    var raiseStorageChanged = (key, oldValue, newValue) => {
        var url = null;

        try {
            var parsedContextUrl = parseProxyUrl(this.context.location.toString());

            url = parsedContextUrl ? parsedContextUrl.destUrl : destLocation.get();
        }
        catch (e) {
            this.context = this.window;
            url          = destLocation.get();
        }

        this.emit(this.STORAGE_CHANGED_EVENT, { key, oldValue, newValue, url });
    };

    var checkStorageChanged = () => {
        var currentState = getCurrentState();

        for (var i = 0; i < this.lastState[KEY].length; i++) {
            var lastStateKey   = this.lastState[KEY][i];
            var lastStateValue = this.lastState[VALUE][i];

            var keyIndex = currentState[KEY].indexOf(lastStateKey);

            if (keyIndex !== -1) {
                if (currentState[VALUE][keyIndex] !== lastStateValue)
                    raiseStorageChanged(currentState[KEY][keyIndex], lastStateValue, currentState[VALUE][keyIndex]);

                currentState[KEY].splice(keyIndex, 1);
                currentState[VALUE].splice(keyIndex, 1);
            }
            else
                raiseStorageChanged(lastStateKey, lastStateValue, null);
        }

        for (var j = 0; j < currentState[KEY].length; j++)
            raiseStorageChanged(currentState[KEY][j], this.EMPTY_OLD_VALUE_ARG, currentState[VALUE][j]);

        this.lastState = getCurrentState();
    };

    var init = () => {
        loadFromNativeStorage();
        this.lastState = getCurrentState();

        window.setInterval(() => checkStorageChanged(), 10);
    };

    this.setContext = context => {
        this.context = context;
    };

    this.getContext = () => this.context;

    this.saveToNativeStorage = () => {
        var state = JSON.stringify(getCurrentState());

        if (this.nativeStorage[this.nativeStorageKey] !== state)
            this.nativeStorage[this.nativeStorageKey] = state;
    };

    var castToString = value => {
        // NOTE: The browser automatically translates the key and the value to a string. To repeat this behavior,
        // we use native storage:
        // localStorage.setItem(null, null) equivalently to localStorage.setItem('null', 'null')
        this.nativeStorage[STORAGES_SANDBOX_TEMP] = value;

        return this.nativeStorage[STORAGES_SANDBOX_TEMP];
    };

    var getValidKey = key => {
        var isWrapperMember = this.wrapperMethods.indexOf(key) !== -1 || this.initialProperties.indexOf(key) !== -1;

        key = isWrapperMember ? API_KEY_PREFIX + key : key;

        return castToString(key);
    };

    // API
    this.clear = () => {
        var addedProperties = getAddedProperties();
        var changed         = false;

        for (var addedProperty of addedProperties) {
            delete this[addedProperty];
            changed = true;
        }

        if (changed) {
            raiseStorageChanged(null, null, null);
            this.lastState = getCurrentState();
        }
    };

    this.getItem = key => {
        if (arguments.length === 0)
            throw new TypeError();

        key = getValidKey(key);

        return this.hasOwnProperty(key) ? this[key] : null;
    };

    this.key = keyNum => {
        if (keyNum === void 0)
            throw new TypeError();

        // NOTE: http://w3c-test.org/webstorage/storage_key.html
        keyNum %= 0x100000000;

        var addedProperties = getAddedProperties();

        return keyNum >= 0 && keyNum < addedProperties.length ? addedProperties[keyNum] : null;
    };

    this.removeItem = key => {
        if (arguments.length === 0)
            throw new TypeError();

        key = getValidKey(key);

        delete this[key];
        checkStorageChanged();
    };

    this.setItem = (key, value) => {
        if (arguments.length < 2)
            throw new TypeError();

        key   = getValidKey(key);
        value = castToString(value);

        this[key] = value;
        checkStorageChanged();
    };

    // NOTE: Save wrapper properties and methods to be able to distinguish them from
    // properties that will be created from the outside.
    this.initialProperties = Object.getOwnPropertyNames(this);
    this.wrapperMethods    = getWrapperMethods();

    init();
}

StorageWrapper.prototype = Storage.prototype;
