import { IncomingHttpHeaders } from 'http';
import { Readable } from 'stream';

interface InitOptions {
    headers: { [name: string]: string|string[] };
    trailers: { [key: string]: string | undefined };
    statusCode: number;
    body: object|string|Buffer|null;
}

const DEFAULT_STATUS_CODE = 200;

export default class IncomingMessageLike extends Readable {
    private _body: Buffer|null;
    headers: IncomingHttpHeaders;
    trailers: { [key: string]: string | undefined };
    statusCode: number;

    constructor (init: Partial<InitOptions> = {}) {
        super();

        const { headers, trailers, statusCode, body } = this._getOptions(init);

        this.headers    = headers;
        this.trailers   = trailers;
        this.statusCode = statusCode;
        this._body      = this._getBody(body);
    }

    private _getOptions (init: Partial<InitOptions>): InitOptions {
        return {
            headers:    Object.assign({}, init.headers),
            trailers:   Object.assign({}, init.trailers),
            statusCode: init.statusCode || DEFAULT_STATUS_CODE,
            body:       init.body || Buffer.alloc(0)
        }
    }

    _read (): void {
        this.push(this._body);
        this._body = null;
    }

    private _getBody (body: object|string|Buffer|null): Buffer {
        if (!body)
            return Buffer.alloc(0);

        else if (body instanceof Buffer)
            return body;

        const bodyStr = typeof body === 'object' ? JSON.stringify(body) : String(body);

        return Buffer.from(bodyStr);
    }
}
