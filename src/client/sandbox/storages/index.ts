import SandboxBase from '../base';
import Listeners from '../event/listeners';
import UnloadSandbox from '../event/unload';
import EventSimulator from '../event/simulator';
import { StoragesSandboxStrategyFactory } from './strategies';

import {
    StorageSandboxFactoryArguments,
    StorageSandboxStrategy,
    StoragesBackup,
} from './interfaces';

export default class StorageSandbox extends SandboxBase {
    private _storageStrategy: StorageSandboxStrategy;

    constructor (private readonly _listeners: Listeners,
                 private readonly _unloadSandbox: UnloadSandbox,
                 private readonly _eventSimulator: EventSimulator) {
        super();
    }

    clear () {
        this._storageStrategy.clear();
    }

    lock () {
        this._storageStrategy.lock();
    }

    unlock () {
        this._storageStrategy.unlock();
    }

    backup (): StoragesBackup {
        return this._storageStrategy.backup();
    }

    restore ({ localStorage, sessionStorage }: StoragesBackup) {
        this._storageStrategy.restore({ localStorage, sessionStorage });
    }

    attach (window: Window & typeof globalThis) {
        super.attach(window);

        this._storageStrategy = StoragesSandboxStrategyFactory.create(this.proxyless, {
            window:         this.window,
            nativeMeths:    this.nativeMethods,
            sandbox:        this,
            unloadSandbox:  this._unloadSandbox,
            eventSimulator: this._eventSimulator,
            listeners:      this._listeners,
        });

        this._storageStrategy.init();
    }

    dispose () {
        this._storageStrategy.dispose();
    }

    get localStorageProxy () {
        return this._storageStrategy.localStorageProxy;
    }

    get sessionStorageProxy () {
        return this._storageStrategy.sessionStorageProxy;
    }
}
