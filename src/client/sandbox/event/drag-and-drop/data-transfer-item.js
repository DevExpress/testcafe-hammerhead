import { setTimeout } from '../../native-methods';
import DATA_TRANSFER_ITEM_KIND from './data-transfer-item-kind';

// https://html.spec.whatwg.org/multipage/interaction.html#datatransferitem
export default class DataTransferItem {
    constructor (kind, type, data) {
        this._kind = kind;
        this._type = type;
        this._data = data;
    }

    get kind () {
        return this._kind;
    }

    get type () {
        return this._type;
    }

    getAsString (callback) {
        if (!arguments.length)
            throw new Error("Failed to execute 'getAsString' on 'DataTransferItem': 1 argument required, but only 0 present.");

        if (typeof callback !== 'function')
            return;

        if (this.kind !== DATA_TRANSFER_ITEM_KIND.string)
            return;

        setTimeout(() => callback(this._data), 0);
    }

    getAsFile () {
        if (this.kind !== DATA_TRANSFER_ITEM_KIND.file)
            return null;

        return this._data;
    }
}
