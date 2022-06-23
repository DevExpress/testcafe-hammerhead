import fs from 'fs';
import { access } from '../../utils/promisified-functions';

export default abstract class BaseResource {
    protected _path: string;
    protected _error: any = null;
    protected _contentStream: any = null;

    protected constructor (path: string) {
        this._path = path;
    }

    abstract init (): Promise<void>

    protected abstract _createContentStream (): void;

    protected async _checkAccess (path: string): Promise<void> {
        try {
            await access(path, fs.constants.R_OK);
        }
        catch (e) {
            this._error = e;
        }
    }

    get error (): any {
        return this._error;
    }

    get contentStream () {
        return this._contentStream;
    }
}
