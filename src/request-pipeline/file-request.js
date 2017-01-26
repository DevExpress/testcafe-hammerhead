import fs from 'fs';
import { EventEmitter } from 'events';
import { parse } from 'url';

const DISK_RE = /^\/[A-Za-z]:/;

export default class FileRequest extends EventEmitter {
    constructor (opts) {
        super();

        var path = decodeURIComponent(parse(opts.url).pathname);

        if (DISK_RE.test(path))
            path = path.substr(1);

        this.stream   = fs.createReadStream(path);
        this.headers  = {};
        this.trailers = {};

        this.stream.on('open', () => this._onOpen());
        this.stream.on('error', err => this._onOpen(err));
    }

    _onOpen (err) {
        this.statusCode = err ? 404 : 200;
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
