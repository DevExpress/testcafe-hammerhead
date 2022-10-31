import SandboxBase from '../base';
import Listeners from '../event/listeners';
import UnloadSandbox from '../event/unload';
import EventSimulator from '../event/simulator';
import nativeMethods from '../native-methods';
import { StorageProxy } from '../../../typings/client';

export interface StoragesBackup {
    localStorage: string;
    sessionStorage: string;
}

export interface StorageSandboxFactoryArguments {
    window: Window & typeof globalThis | null;
    nativeMeths: typeof nativeMethods;
    sandbox: SandboxBase,
    unloadSandbox: UnloadSandbox,
    eventSimulator: EventSimulator,
    listeners: Listeners,
}

export interface StorageSandboxStrategy {
    localStorageProxy: StorageProxy | null;
    sessionStorageProxy: StorageProxy | null;
    clear: () => void;
    lock: () => void;
    backup: () => StoragesBackup;
    restore: (storagesBackup: StoragesBackup) => void;
    dispose: () => void;
    init: () => void;
}
