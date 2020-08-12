import { getTopSameDomainWindow, getFrameElement } from '../utils/dom';
import nativeMethods from './native-methods';
import Sandbox from './index';

const SANDBOX_BACKUP = 'hammerhead|sandbox-backup';

interface SandboxBackupEntry {
    iframe: Element;
    sandbox: Sandbox;
}

function findRecord (storage: SandboxBackupEntry[], iframe: Element | null) {
    for (let i = storage.length - 1; i >= 0; i--) {
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

export function create (window: Window, sandbox: Sandbox) {
    const topSameDomainWindow = getTopSameDomainWindow(window);
    const iframe              = window !== topSameDomainWindow ? getFrameElement(window) : null;
    let storage               = topSameDomainWindow[SANDBOX_BACKUP];

    if (!storage) {
        storage = [];
        nativeMethods.objectDefineProperty(topSameDomainWindow, SANDBOX_BACKUP, { value: storage });
    }

    const record = findRecord(storage, iframe);

    if (record)
        record.sandbox = sandbox;
    else
        storage.push({ iframe, sandbox });
}

export function get (window: Window) {
    const topSameDomainWindow = getTopSameDomainWindow(window);
    const storage             = topSameDomainWindow[SANDBOX_BACKUP];
    const iframe              = window !== topSameDomainWindow ? window.frameElement : null;

    if (storage) {
        const record = findRecord(storage, iframe);

        return record ? record.sandbox : null;
    }

    return null;
}

