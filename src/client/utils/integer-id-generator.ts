const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER || 9007199254740991;
const MIN_SAFE_INTEGER = Number.MIN_SAFE_INTEGER || -9007199254740991;

export default class IntegerIdGenerator {
    private _id = MIN_SAFE_INTEGER;

    increment (): number {
        this._id = this._id === MAX_SAFE_INTEGER ? MIN_SAFE_INTEGER : this._id + 1;

        return this._id;
    }

    get value (): number {
        return this._id;
    }
}
