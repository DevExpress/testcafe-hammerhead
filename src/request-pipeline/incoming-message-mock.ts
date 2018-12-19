import { Readable } from 'stream';

export default class IncomingMessageMock extends Readable {
    headers: any;
    trailers: any;
    statusCode: string;
    _body: any;

    constructor (init) {
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

    _getBody (body) {
        if (!body)
            return Buffer.alloc(0);

        else if (body instanceof Buffer)
            return body;

        const bodyStr = typeof body === 'object' ? JSON.stringify(body) : String(body);

        return Buffer.from(bodyStr);
    }
}
