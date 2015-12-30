import { getTopSameDomainWindow, getFrameElement } from '../utils/dom';

const SANDBOX_BACKUP = 'hammerhead|sandbox-backup';

export function create (window, sandbox) {
    var topSameDomainWindow = getTopSameDomainWindow(window);

    if (!topSameDomainWindow[SANDBOX_BACKUP])
        topSameDomainWindow[SANDBOX_BACKUP] = [];

    topSameDomainWindow[SANDBOX_BACKUP].push({
        iframe:  window !== topSameDomainWindow ? getFrameElement(window) : null,
        sandbox: sandbox
    });
}

export function get (window) {
    var topSameDomainWindow = getTopSameDomainWindow(window);
    var storage             = topSameDomainWindow[SANDBOX_BACKUP];
    var iframe              = window !== topSameDomainWindow ? window.frameElement : null;

    if (storage) {
        for (var i = 0; i < storage.length; i++) {
            if (storage[i].iframe === iframe)
                return storage[i].sandbox;
        }

        return null;
    }
}

