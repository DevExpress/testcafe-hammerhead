import BaseResource from './base-resource';
import Asar from '../../utils/asar';
import path from 'path';

const asar = new Asar();

export default class AsarResource extends BaseResource {
    private _archive = '';
    private _fileName = '';

    constructor (resourcePath: string) {
        // NOTE: use a normalized path (GH-2101 PR)
        super(path.normalize(resourcePath));
    }

    protected _createContentStream (): void {
        try {
            this._contentStream = asar.extractFileToReadStream(this._archive, this._fileName);
        }
        catch (e) {
            e.message = asar.getFileInAsarNotFoundErrorMessage(this._archive, this._fileName);

            this._error = e;
        }
    }

    get isArchiveFound (): boolean {
        return !!this._archive;
    }

    async init (): Promise<void> {
        if (!await asar.isAsar(this._path))
            return;

        const { archive, fileName } = await asar.parse(this._path);

        this._archive  = archive;
        this._fileName = fileName;

        await this._checkAccess(this._archive);

        if (!this._error)
            this._createContentStream();
    }
}
