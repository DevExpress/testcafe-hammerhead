import fs from 'fs';
import mime from 'mime';
import { EventEmitter } from 'events';
import { parse } from 'url';
import { MESSAGE, getText } from '../messages';

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
        fs.stat(this.path, (err, stats) => {
            if (err) {
                this._onError(err);

                return;
            }

            if (!stats.isFile())
                this._onError(new Error(TARGET_IS_NOT_FILE));
            else {
                fs.access(this.path, fs.constants.R_OK, e => {
                    if (err)
                        this._onError(e);
                    else
                        this._onOpen();
                });
            }
        });
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
