import fs from 'fs';
// @ts-ignore
import mime from 'mime';
import { EventEmitter } from 'events';
import { parse } from 'url';
import { MESSAGE, getText } from '../messages';
import { stat, access } from '../utils/promisified-functions';
import { isAsarPath, getArchivePath, extractFileToReadStream } from '../utils/asar';

const DISK_RE: RegExp = /^\/[A-Za-z]:/;

const TARGET_IS_NOT_FILE              = 'The target of the operation is not a file';
const ASAR_ARCHIVE_TARGET_IS_NOT_FILE = 'The asar archive target of the operation is not a file';

export default class FileRequest extends EventEmitter {
    url: string;
    path: string;
    isAsarPath: boolean;

    constructor (url: string) {
        super();

        this.url        = url;
        this.path       = FileRequest._getPath(url);
        this.isAsarPath = isAsarPath(this.path);

        this._initEvents();
    }

    private _initEvents () {
        if (this.isAsarPath) {
            const asarArchivePath = getArchivePath(this.path);

            stat(asarArchivePath)
                .catch(() => {
                    throw new Error(ASAR_ARCHIVE_TARGET_IS_NOT_FILE);
                })
                .then(() => access(asarArchivePath, fs.constants.R_OK))
                .then(() => this._onOpen())
                .catch((err: Error) => {

                    return this._onError(err);
                });
        }
        else {
            stat(this.path)
                .then((stats: fs.Stats) => {
                    if (!stats.isFile())
                        throw new Error(TARGET_IS_NOT_FILE);

                    return access(this.path, fs.constants.R_OK);
                })
                .then(() => this._onOpen())
                .catch((err: Error) => this._onError(err));
        }
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
        let stream = this.isAsarPath
            ? extractFileToReadStream(this.path)
            : fs.createReadStream(this.path);

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
