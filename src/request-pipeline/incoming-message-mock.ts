/*eslint-disable no-unused-vars*/
import { IncomingHttpHeaders } from 'http';
/*eslint-enable no-unused-vars*/
import { Readable } from 'stream';

type InitOptions = {
    headers: { [name: string]: string|Array<string> };
    trailers: { [key: string]: string | undefined };
    statusCode: number;
    _body: object|string|Buffer|null;
};

export default class IncomingMessageMock extends Readable {
    private _body: Buffer|null;
    headers: IncomingHttpHeaders;
    trailers: { [key: string]: string | undefined };
    statusCode: number;

    constructor (init: InitOptions) {
        super();

        this.headers    = init.headers;
        this.trailers   = init.trailers;
        this.statusCode = init.statusCode;
        this._body      = this._getBody(init._body);
    }

    _read () {
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
