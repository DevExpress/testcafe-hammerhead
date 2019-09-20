/*eslint-disable no-unused-vars*/
import { AddPendingRequestServiceMessage } from '../typings/session';
/*eslint-enable no-unused-vars*/
import generateUniqueId from '../utils/generate-unique-id';

export default class PendingRequestStorage {
    private readonly _storage: Map<string, any>;

    constructor () {
        this._storage = new Map<string, any>();
    }

    add (msg: AddPendingRequestServiceMessage): string {
        const requestId = generateUniqueId();

        this._storage.set(requestId, msg);

        return requestId;
    }

    get (requestId: string): any {
        return this._storage.get(requestId);
    }
}
