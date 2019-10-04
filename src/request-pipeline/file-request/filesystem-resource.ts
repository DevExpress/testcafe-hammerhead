import BaseResource from './base-resource';
import fs from 'fs';
import { stat } from '../../utils/promisified-functions';

const TARGET_IS_NOT_FILE = 'The target of the operation is not a file';

export default class FileSystemResource extends BaseResource {
    constructor (path: string) {
        super(path);
    }

    private _getStat (): Promise<{ err: any; stats: fs.Stats | null }> {
        return stat(this._path)
            .then((stats: fs.Stats) => ({ stats, err: null }), (err: any) => ({ stats: null, err }));
    }

    protected _createContentStream (): void {
        this._contentStream = fs.createReadStream(this._path);
    }

    async init (): Promise<void> {
        const { err, stats } = await this._getStat();

        this._error = err;

        if (stats) {
            if (!stats.isFile())
                this._error = new Error(TARGET_IS_NOT_FILE);

            await this._checkAccess(this._path);
        }

        if (!this._error)
            this._createContentStream();
    }
}
