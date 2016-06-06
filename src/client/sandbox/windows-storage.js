import { getTopSameDomainWindow } from '../utils/dom';

const WINDOWS_STORAGE = 'hammerhead|windows-storage';

function getStorage () {
    var topSameDomainWindow = getTopSameDomainWindow(window);
    var storage             = topSameDomainWindow[WINDOWS_STORAGE];

    if (!storage) {
        storage = [];
        topSameDomainWindow[WINDOWS_STORAGE] = storage;
    }

    return storage;
}

export function add (wnd) {
    var storage = getStorage();

    if (storage.indexOf(wnd) === -1)
        storage.push(wnd);
}

export function remove (wnd) {
    var storage   = getStorage();
    var index     = storage.indexOf(wnd);

    if (index !== -1)
        storage.splice(index, 1);
}

export function findByName (name) {
    var storage = getStorage();

    for (var i = 0; i < storage.length; i++) {
        if (storage[i].name === name)
            return storage[i];
    }

    return null;
}
