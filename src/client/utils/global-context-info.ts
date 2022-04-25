const isInWorker = typeof window === 'undefined' && typeof self === 'object';
const global     = (isInWorker ? self : window) as Window & typeof globalThis;

export default {
    isInWorker,
    global,

    isServiceWorker: isInWorker && !global.XMLHttpRequest,
};
