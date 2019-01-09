import fs from 'fs';
import mime from 'mime';
import { EventEmitter } from 'events';
import { parse } from 'url';
import { MESSAGE, getText } from '../messages';
import { stat, access } from '../utils/promisified-functions';

const DISK_RE = /^\/[A-Za-z]:/;

const TARGET_IS_NOT_FILE = 'The target of the operation is not a file';

export default class FileRequest extends EventEmitter {
    constructor (opts) {
        super();

        this.url  = opts.url;
        this.path = FileRequest._getPath(opts.url);

        this._initEvents();
    }

    _initEvents () {
        stat(this.path)
            .then(stats => {
                if (!stats.isFile())
                    throw new Error(TARGET_IS_NOT_FILE);
            })
            .then(() => {
                return access(this.path, fs.constants.R_OK);
            })
            .then(() => {
                this._onOpen();
            })
            .catch(err => this._onError(err));
    }

    static _getPath (proxiedUrl) {
        const parsedUrl = parse(proxiedUrl);
        let path        = decodeURIComponent(parsedUrl.pathname);

        if (DISK_RE.test(path))
            path = path.substr(1);

        return path;
    }

    _onError (err) {
        this.emit('fatalError', getText(MESSAGE.cantReadFile, this.url, err.message));
    }

    _onOpen () {
        let stream = fs.createReadStream(this.path);

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
