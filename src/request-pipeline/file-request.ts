import fs from 'fs';
// @ts-ignore
import mime from 'mime';
import { EventEmitter } from 'events';
import { parse } from 'url';
import { MESSAGE, getText } from '../messages';
import { stat, access } from '../utils/promisified-functions';
import Asar from '../utils/asar';

const DISK_RE: RegExp = /^\/[A-Za-z]:/;

const TARGET_IS_NOT_FILE: string = 'The target of the operation is not a file';

const asar = new Asar();

export default class FileRequest extends EventEmitter {
    private _url: string;
    private _path: string;
    private _isAsar: boolean = false;

    constructor (url: string) {
        super();

        this._url  = url;
        this._path = FileRequest._getPath(url);

        this._initEvents();
    }

    private _initEvents () {
        stat(this._path)
            .then((stats: fs.Stats) => {
                if (!stats.isFile())
                    throw new Error(TARGET_IS_NOT_FILE);

                return access(this._path, fs.constants.R_OK);
            })
            .then(() => this._onOpen())
            .catch(async (err: Error) => {
                if (!await asar.isAsar(this._path))
                    return this._onError(err);

                this._isAsar = true;

                const asarArchivePath = asar.getArchivePath(this._path);

                return access(asarArchivePath, fs.constants.R_OK)
                    .then(() => this._onOpen())
                    .catch((asarErr: Error) => {
                        asarErr.message = asar.getFileInAsarNotFoundMessage(this._path);

                        return this._onError(asarErr);
                    });
            });
    }

    private static _getPath (proxiedUrl: string): string {
        const parsedUrl = parse(proxiedUrl);
        // @ts-ignore
        let path = decodeURIComponent(parsedUrl.pathname);

        if (DISK_RE.test(path))
            path = path.substr(1);

        return path;
    }

    private _onError (err: Error) {
        this.emit('fatalError', getText(MESSAGE.cantReadFile, this._url, err.message));
    }

    private _onOpen () {
        let stream = this._isAsar
            ? asar.extractFileToReadStream(this._path)
            : fs.createReadStream(this._path);

        stream = Object.assign(stream, {
            statusCode: 200,
            trailers:   {},
            headers:    {
                'content-type': mime.lookup(this._path)
            }
        });

        this.emit('response', stream);
    }
}
