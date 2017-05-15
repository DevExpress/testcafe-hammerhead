import DATA_STORE_MODE from './data-store-mode';

// https://html.spec.whatwg.org/multipage/interaction.html#the-drag-data-store
export default class DataStore {
    constructor () {
        this.mode = DATA_STORE_MODE.readwrite;
    }
}
