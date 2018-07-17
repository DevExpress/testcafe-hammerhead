const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER || 9007199254740991;
const MIN_SAFE_INTEGER = Number.MIN_SAFE_INTEGER || -9007199254740991;

export default function createIntegerIdGenerator () {
    let id = MIN_SAFE_INTEGER;

    return {
        increment: () => {
            id = id === MAX_SAFE_INTEGER ? MIN_SAFE_INTEGER : id + 1;

            return id;
        },

        get value () {
            return id;
        }
    };
}
