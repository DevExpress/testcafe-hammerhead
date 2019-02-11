import DATA_STORE_MODE from './data-store-mode';

// https://html.spec.whatwg.org/multipage/interaction.html#the-drag-data-store
export default class DragDataStore {
    mode: any;

    constructor () {
        this.mode = DATA_STORE_MODE.readwrite;
    }

    setReadOnlyMode () {
        this.mode = DATA_STORE_MODE.readonly;
    }

    setProtectedMode () {
        this.mode = DATA_STORE_MODE.protected;
    }
}
