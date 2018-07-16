const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER || 9007199254740991;
const MIN_SAFE_INTEGER = Number.MIN_SAFE_INTEGER || -9007199254740991;

export default function createAutoIncrementIdGenerator () {
    let id = MIN_SAFE_INTEGER;

    return {
        increment: () => {
            if (id === MAX_SAFE_INTEGER)
                id = MIN_SAFE_INTEGER;
            else
                ++id;

            return id;
        },

        get: () => id
    };
}
