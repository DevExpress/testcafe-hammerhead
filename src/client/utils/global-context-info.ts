export default function getGlobalContextInfo () {
    const isInWorker = typeof window === 'undefined' && typeof self === 'object';

    return {
        isInWorker,
        global: isInWorker ? self : window
    };
}
