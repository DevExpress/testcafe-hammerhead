import { getTopSameDomainWindow } from '../utils/dom';

const SANDBOXES_STORAGE = 'hammerhead|sandboxes-storage';

export function addSandboxToStorage (window, sandbox) {
    var topSameDomainWindow = getTopSameDomainWindow(window);

    if (!topSameDomainWindow[SANDBOXES_STORAGE])
        topSameDomainWindow[SANDBOXES_STORAGE] = [];

    topSameDomainWindow[SANDBOXES_STORAGE].push({
        iframe:  window !== topSameDomainWindow ? window.frameElement : null,
        sandbox: sandbox
    });
}

export function getSandboxFromStorage (window) {
    var topSameDomainWindow = getTopSameDomainWindow(window);
    var storage             = topSameDomainWindow[SANDBOXES_STORAGE];
    var iframe              = window !== topSameDomainWindow ? window.frameElement : null;

    if (storage) {
        for (var i = 0; i < storage.length; i++) {
            if (storage[i].iframe === iframe)
                return storage[i].sandbox;
        }

        return null;
    }
}

