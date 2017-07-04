import fs from 'fs';
import mime from 'mime';
import { EventEmitter } from 'events';
import { parse } from 'url';
import { MESSAGE, getText } from '../messages';


const DISK_RE = /^\/[A-Za-z]:/;

export default class FileRequest extends EventEmitter {
    constructor (opts) {
        super();

        const parsedUrl = parse(opts.url);
        let path        = decodeURIComponent(parsedUrl.pathname);

        if (DISK_RE.test(path))
            path = path.substr(1);

        this.url      = opts.url;
        this.stream   = fs.createReadStream(path);
        this.headers  = {};
        this.trailers = {};
        this.path     = path;

        this.stream.once('readable', () => this._onOpen());
        this.stream.on('error', err => this._onError(err));
    }

    _onError (err) {
        this.statusCode = 404;
        this.emit('fatalError', getText(MESSAGE.cantReadFile, this.url, err.message));
    }

    _onOpen () {
        this.statusCode              = 200;
        this.headers['content-type'] = mime.lookup(this.path);

        this.emit('response', this);
    }

    on (type, handler) {
        if (type === 'data' || type === 'end') {
            if (this.statusCode !== 404) {
                this.stream.on(type, handler);

                if (type === 'end')
                    this.stream.on(type, () => this.stream.close());
            }
            else if (type === 'end')
                handler.call(this);
        }
        else
            super.on(type, handler);
    }

    pipe (res) {
        if (this.statusCode === 404)
            res.end('');
        else
            this.stream.pipe(res);
    }
}
