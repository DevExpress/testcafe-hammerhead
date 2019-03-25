/*eslint-disable no-unused-vars*/
import { StoragesSnapshot } from '../typings/session';
/*eslint-enable no-unused-vars*/

export default class StateSnapshot {
    cookies: string | null;
    storages: StoragesSnapshot | null;

    constructor (cookie: string | null, storages: StoragesSnapshot | null) {
        this.cookies  = cookie;
        this.storages = storages;
    }

    static empty () {
        return new StateSnapshot(null, {
            localStorage:   '[[],[]]',
            sessionStorage: '[[],[]]'
        });
    }
}
