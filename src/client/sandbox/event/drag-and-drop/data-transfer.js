// NOTE: Although DataTransfer interface has a constructor, it is not possible to
// create a useful DataTransfer object from script, since DataTransfer objects have a
// processing and security model that is coordinated by the browser during drag-and-drops.
// So we have to create a mock for it to use it in drag-and-drop events
import DataStore from './data-store';
import DataTransferItemList from './data-transfer-item-list';
import DATA_STORE_MODE from './data-store-mode';

// https://html.spec.whatwg.org/multipage/interaction.html#dom-datatransfer-dropeffect
const DROP_EFFECT = {
    none: 'none',
    copy: 'copy',
    link: 'link',
    move: 'move'
};

// https://html.spec.whatwg.org/multipage/interaction.html#dom-datatransfer-effectallowed
const EFFECT_ALLOWED = {
    uninitialized: 'uninitialized',
    none:          'none',
    copy:          'copy',
    copyLink:      'copyLink',
    copyMove:      'copyMove',
    link:          'link',
    linkMove:      'linkMove',
    move:          'move',
    all:           'all'
};

// https://html.spec.whatwg.org/multipage/interaction.html#datatransfer
export default class DataTransfer {
    constructor () {
        this._dropEffect    = DROP_EFFECT.none;
        this._effectAllowed = EFFECT_ALLOWED.uninitialized;
        this._dataStore     = new DataStore();

        this.itemList = new DataTransferItemList(this._dataStore);
    }

    _setReadOnlyMode () {
        this._dataStore.mode = DATA_STORE_MODE.readonly;
    }

    _setProtectedMode () {
        this._dataStore.mode = DATA_STORE_MODE.protected;
        this.itemList        = new DataTransferItemList(this._dataStore);
    }

    get dropEffect () {
        return this._dropEffect;
    }

    set dropEffect (value) {
        if (DROP_EFFECT[value])
            this._dropEffect = DROP_EFFECT[value];

        return value;
    }

    get effectAllowed () {
        return this._effectAllowed;
    }

    set effectAllowed (value) {
        if (EFFECT_ALLOWED[value])
            this._effectAllowed = EFFECT_ALLOWED[value];

        return value;
    }

    get items () {
        return this.itemList;
    }

    setDragImage () {
        // do nothing
    }

    get types () {
        return this.itemList._types;
    }

    getData (format) {
        if (!arguments.length)
            throw new Error("Failed to execute 'getData' on 'DataTransfer': 1 argument required, but only 0 present.");

        format = format.toString().toLowerCase();

        return this.itemList._getItem(format);
    }

    setData (format, data) {
        if (arguments.length < 2)
            throw new Error(`Failed to execute 'setData' on 'DataTransfer': 2 argument required, but only ${arguments.length} present.`);

        if (this._dataStore.mode !== DATA_STORE_MODE.readwrite)
            return;

        format = format.toString().toLowerCase();

        this.itemList._addItem(data, format, true);
    }

    clearData (format) {
        if (this._dataStore.mode !== DATA_STORE_MODE.readwrite)
            return;

        if (format === void 0)
            this.itemList.clear();
        else
            this.itemList._removeItem(format);
    }

    get files () {
        return [];
    }
}
