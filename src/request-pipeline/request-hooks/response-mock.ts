import IncomingMessageMock from '../incoming-message-mock';
import { JSON_MIME } from '../../utils/content-type';
import BUILTIN_HEADERS from '../builtin-header-names';
import RequestOptions from '../request-options';

const PAGE_CONTENT_TYPE = 'text/html; charset=utf-8';
const EMPTY_PAGE_HTML   = '<html><body></body></html>';

const INVALID_BODY_PARAMETER_TYPES = ['number', 'boolean'];

const INVALID_STATUS_CODE_MESSAGE = 'Invalid status code. It should be a number that is greater than 100 and less than 999.';

export default class ResponseMock {
    private readonly body: any;
    readonly statusCode: string;
    readonly headers: any;
    requestOptions: RequestOptions = null;

    constructor (body, statusCode, headers) {
        this.body       = body;
        this.statusCode = statusCode;
        this.headers    = this._lowerCaseHeaderNames(headers);

        this._validateParameters();
    }

    _lowerCaseHeaderNames (headers) {
        if (!headers)
            return headers;

        const lowerCaseHeaders = {};

        Object.keys(headers).forEach(headerName => {
            lowerCaseHeaders[headerName.toLowerCase()] = headers[headerName];
        });

        return lowerCaseHeaders;
    }

    _validateBody () {
        const bodyType = typeof this.body;

        if (INVALID_BODY_PARAMETER_TYPES.includes(bodyType))
            throw new TypeError(`The 'body' parameter has an invalid type - ${bodyType}.`);
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
            throw new TypeError('Invalid type of the \'headers\' parameter. It should be an object.');
    }

    _validateParameters () {
        this._validateBody();
        this._validateStatusCode();
        this._validateHeaders();
    }

    _getContentType (): string {
        if (this.body !== null && typeof this.body === 'object')
            return JSON_MIME;

        return PAGE_CONTENT_TYPE;
    }

    setRequestOptions (opts: RequestOptions): void {
        this.requestOptions = opts;
    }

    async getResponse (): Promise<IncomingMessageMock> {
        let response: any = {
            headers:    { [BUILTIN_HEADERS.contentType]: this._getContentType() },
            trailers:   {},
            statusCode: this.statusCode || 200
        };

        if (this.headers)
            response.headers = Object.assign(response.headers, this.headers);

        if (this.body === void 0)
            response._body = EMPTY_PAGE_HTML;
        else if (typeof this.body === 'function') {
            response.setBody = value => {
                response._body = value;
            };

            response = Object.assign(response, await this.body(this.requestOptions, response));

            delete response.setBody;
        }
        else
            response._body = this.body;

        response.headers = this._lowerCaseHeaderNames(response.headers);

        return new IncomingMessageMock(response);
    }
}
