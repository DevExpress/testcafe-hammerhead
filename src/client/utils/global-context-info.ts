export default function getGlobalContextInfo () {
    const isInWorker = typeof window === 'undefined' && typeof self === 'object';
    const global     = (isInWorker ? self : window) as Window & typeof globalThis;

    return {
        isInWorker,
        global,

        isServiceWorker: isInWorker && !global.XMLHttpRequest
    };
}
