import fs from 'fs';
// @ts-ignore
import mime from 'mime';
import { EventEmitter } from 'events';
import { parse } from 'url';
import { MESSAGE, getText } from '../messages';
import { stat, access } from '../utils/promisified-functions';
import { getParentAsarArchivePath, extractFileToReadStream } from '../utils/asar';

const DISK_RE: RegExp = /^\/[A-Za-z]:/;

const TARGET_IS_NOT_FILE = 'The target of the operation is not a file';

export default class FileRequest extends EventEmitter {
    url: string;
    path: string;
    isAsarPath: boolean;
    asarArchivePath: string;

    constructor (url: string) {
        super();

        this.url        = url;
        this.path       = FileRequest._getPath(url);
        this.isAsarPath = false;

        this._initEvents();
    }

    private _initEvents () {
        stat(this.path)
            .then((stats: fs.Stats) => {
                if (!stats.isFile())
                    throw new Error(TARGET_IS_NOT_FILE);

                return access(this.path, fs.constants.R_OK);
            })
            .then(() => this._onOpen())
            .catch((err: Error) => {
                const asarArchivePath = getParentAsarArchivePath(this.path);

                if (asarArchivePath) {
                    this.isAsarPath      = true;
                    this.asarArchivePath = asarArchivePath;

                    return access(this.asarArchivePath, fs.constants.R_OK)
                        .then(() => this._onOpen());
                }

                return this._onError(err);
            })
            .catch((err: Error) => {
                const fileName  = this.path.replace(this.asarArchivePath, '');
                const arhiveUrl = this.url.replace(fileName, '');

                err.message = 'The target file (".' + fileName + '") in asar archive ("' + arhiveUrl + '") is not found';

                return this._onError(err);
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
        this.emit('fatalError', getText(MESSAGE.cantReadFile, this.url, err.message));
    }

    private _onOpen () {
        let stream;

        if (this.isAsarPath) {
            const fileName = this.path.replace(this.asarArchivePath, '.');

            stream = extractFileToReadStream(this.asarArchivePath, fileName);
        }
        else
            stream = fs.createReadStream(this.path);

        stream = Object.assign(stream, {
            statusCode: 200,
            trailers:   {},
            headers:    {
                'content-type': mime.lookup(this.path)
            }
        });

        this.emit('response', stream);
    }
}
