import { StoragesSnapshot } from '../typings/session';

export default class StateSnapshot {
    cookies: string | null;
    storages: StoragesSnapshot | null;

    constructor (cookies: string | null, storages: StoragesSnapshot | null) {
        this.cookies  = cookies;
        this.storages = storages;
    }

    static empty () {
        return new StateSnapshot(null, {
            localStorage:   '[[],[]]',
            sessionStorage: '[[],[]]',
        });
    }
}
