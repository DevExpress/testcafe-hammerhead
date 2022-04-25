import { IncomingHttpHeaders, IncomingMessage } from 'http';
import { Readable } from 'stream';

export interface IncomingMessageLikeInitOptions {
    headers: IncomingHttpHeaders;
    trailers: { [key: string]: string | undefined };
    statusCode: number;
    body: object|string|Buffer|null;
}

const DEFAULT_STATUS_CODE = 200;

export default class IncomingMessageLike extends Readable {
    private _body: Buffer | null;
    headers: IncomingHttpHeaders;
    trailers: { [key: string]: string | undefined };
    statusCode: number;

    constructor (init: Partial<IncomingMessageLikeInitOptions> = {}) {
        super();

        const { headers, trailers, statusCode, body } = this._initOptions(init);

        this.headers    = headers;
        this.trailers   = trailers;
        this.statusCode = statusCode;
        this._body      = this._initBody(body);
    }

    private _initOptions (init: Partial<IncomingMessageLikeInitOptions>): IncomingMessageLikeInitOptions {
        return {
            headers:    Object.assign({}, init.headers),
            trailers:   Object.assign({}, init.trailers),
            statusCode: init.statusCode || DEFAULT_STATUS_CODE,
            body:       init.body || Buffer.alloc(0),
        };
    }

    private _initBody (body: object|string|Buffer|null): Buffer {
        if (!body)
            return Buffer.alloc(0);

        else if (body instanceof Buffer)
            return body;

        const bodyStr = typeof body === 'object' ? JSON.stringify(body) : String(body);

        return Buffer.from(bodyStr);
    }

    _read (): void {
        this.push(this._body);
        this._body = null;
    }

    setBody (value: Buffer): void {
        this._body = value;
    }

    getBody (): Buffer | null {
        return this._body;
    }

    static createFrom (res: IncomingMessage): IncomingMessageLike {
        const { headers = {}, trailers, statusCode } = res;

        return new IncomingMessageLike({
            headers,
            trailers,
            statusCode,
        });
    }

    static isIncomingMessageLike (obj: object): obj is IncomingMessageLike {
        return obj instanceof IncomingMessageLike;
    }
}
