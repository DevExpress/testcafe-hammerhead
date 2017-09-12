import { JSON_MIME } from '../../utils/content-type';

const PAGE_CONTENT_TYPE = 'text/html; charset=utf-8';
const EMPTY_PAGE_HTML   = '<html><body></body></html>';

const INVALID_BODY_PARAMETER_TYPES = ['number', 'boolean'];

const INVALID_STATUS_CODE_MESSAGE = 'Invalid status code. It should be more 100 and less 999';

export default class ResponseMock {
    constructor (body, statusCode, headers) {
        this.body       = body;
        this.statusCode = statusCode;
        this.headers    = headers;

        this.requestOptions = null;

        this._validateParameters();
    }

    _validateBody () {
        const bodyType = typeof this.body;

        if (INVALID_BODY_PARAMETER_TYPES.indexOf(bodyType) !== -1)
            throw new TypeError(`You specify invalid type ${bodyType} for body parameter`);
    }

    _validateStatusCode () {
        if (this.statusCode === void 0)
            return;

        if (typeof this.statusCode !== 'number')
            throw new TypeError(INVALID_STATUS_CODE_MESSAGE);

        let statusCode = parseInt(this.statusCode, 10);

        // NOTE: for Infinity case
        statusCode |= 0;

        if (statusCode < 100 || statusCode > 999)
            throw new TypeError(INVALID_STATUS_CODE_MESSAGE);
    }

    _validateHeaders () {
        if (this.headers === void 0)
            return;

        if (typeof this.headers !== 'object')
            throw new TypeError('headers parameter should be an object');
    }

    _validateParameters () {
        this._validateBody();
        this._validateStatusCode();
        this._validateHeaders();
    }

    _getContentType () {
        if (this.body !== null && typeof this.body === 'object')
            return JSON_MIME;

        return PAGE_CONTENT_TYPE;
    }

    setRequestOptions (opts) {
        this.requestOptions = opts;
    }

    getResponse () {
        let response = {
            headers: {
                'content-type': this._getContentType()
            },

            trailers:   {},
            statusCode: this.statusCode || 200
        };

        if (this.body === void 0)
            this.body = EMPTY_PAGE_HTML;
        else if (typeof this.body === 'function') {
            response.setBody = value => {
                this.body = value;
            };
            response         = Object.assign(response, this.body(this.requestOptions, response));
            delete response.setBody;
        }

        if (this.headers)
            response.headers = Object.assign(response.headers, this.headers);

        return response;
    }

    getBody () {
        if (!this.body)
            return new Uint8Array(0);

        const bodyStr = typeof this.body === 'object' ? JSON.stringify(this.body) : String(this.body);

        return Buffer.from(bodyStr);
    }
}
