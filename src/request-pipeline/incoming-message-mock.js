import { Readable } from 'stream';

export default class IncomingMessageMock extends Readable {
    constructor (responseInit) {
        super();

        this.headers    = responseInit.headers;
        this.trailers   = responseInit.trailers;
        this.statusCode = responseInit.statusCode;
        this._body      = this._getBody(responseInit._body);
    }

    _read () {
        this.push(this._body);
        this._body = null;
    }

    _getBody (body) {
        if (!body)
            return new Buffer(0);

        const bodyStr = typeof body === 'object' ? JSON.stringify(body) : String(body);

        return Buffer.from(bodyStr);
    }
}
