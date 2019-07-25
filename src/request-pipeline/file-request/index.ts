// @ts-ignore
import mime from 'mime';
import { EventEmitter } from 'events';
import { parse } from 'url';
import { MESSAGE, getText } from '../../messages';
import createResource from './create-resource';

const DISK_RE: RegExp = /^\/[A-Za-z]:/;

export default class FileRequest extends EventEmitter {
    private _url: string;
    private _path: string;

    constructor (url: string) {
        super();

        this._url  = url;
        this._path = FileRequest._getPath(url);
    }

    async init () : Promise<void> {
        const resource = await createResource(this._path);

        if (resource.error)
            this._onError(resource.error);
        else
            this._onOpen(resource.contentStream);
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

    private _onOpen (contentStream: any) {
        let stream = contentStream;

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
