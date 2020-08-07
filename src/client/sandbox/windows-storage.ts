import { getTopSameDomainWindow } from '../utils/dom';
import nativeMethods from './native-methods';

const WINDOWS_STORAGE = 'hammerhead|windows-storage';

function getStorage () {
    const topSameDomainWindow = getTopSameDomainWindow(window);
    let storage               = topSameDomainWindow[WINDOWS_STORAGE];

    if (!storage) {
        storage = [];
        nativeMethods.objectDefineProperty(topSameDomainWindow, WINDOWS_STORAGE, { value: storage });
    }

    return storage;
}

export function add (wnd) {
    const storage = getStorage();

    for (let i = storage.length - 1; i >= 0; i--) {
        try {
            if (storage[i] === wnd)
                return;
        }
        catch (e) {
            storage.splice(i, 1);
        }
    }

    storage.push(wnd);
}

export function remove (wnd) {
    const storage = getStorage();
    const index   = storage.indexOf(wnd);

    if (index !== -1)
        storage.splice(index, 1);
}

export function findByName (name: string) {
    const storage = getStorage();

    for (let i = 0; i < storage.length; i++) {
        try {
            if (storage[i].name === name)
                return storage[i];
        }
        catch (e) {
            // NOTE: During loading, an iframe can be changed from same-domain to cross-domain.
            // Iframe's window is reinitialized, and we add 2 windows to the window storages:
            // one to the same-domain storage and another one to the cross-domain storage.
            // We remove the cross-domain window from this storage
            // because it is already added to the cross-domain window storage.
            storage.splice(i, 1);
            i--;
        }
    }

    return null;
}
