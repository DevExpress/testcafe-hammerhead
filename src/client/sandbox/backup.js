import { getTopSameDomainWindow, getFrameElement } from '../utils/dom';

const SANDBOX_BACKUP = 'hammerhead|sandbox-backup';


function findRecord (storage, iframe) {
    for (var i = storage.length - 1; i >= 0; i--) {
        try {
            if (storage[i].iframe === iframe)
                return storage[i];
        }
        catch (e) {
            storage.splice(i, 1);
        }
    }

    return void 0;
}

export function create (window, sandbox) {
    var topSameDomainWindow = getTopSameDomainWindow(window);
    var iframe              = window !== topSameDomainWindow ? getFrameElement(window) : null;
    var storage             = topSameDomainWindow[SANDBOX_BACKUP];

    if (!storage) {
        storage = [];
        Object.defineProperty(topSameDomainWindow, SANDBOX_BACKUP, { value: storage });
    }

    var record = findRecord(storage, iframe);

    if (record)
        record.sandbox = sandbox;
    else
        storage.push({ iframe, sandbox });
}

export function get (window) {
    var topSameDomainWindow = getTopSameDomainWindow(window);
    var storage             = topSameDomainWindow[SANDBOX_BACKUP];
    var iframe              = window !== topSameDomainWindow ? window.frameElement : null;

    if (storage) {
        var record = findRecord(storage, iframe);

        return record ? record.sandbox : null;
    }

    return null;
}

