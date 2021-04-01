import RequestOptions from '../../request-options';
import generateUniqueId from '../../../utils/generate-unique-id';
import validateResponseMockParameters from './validate-parameters';
import { ResponseMockBodyInit } from './response-mock-init';
import lowerCaseHeaderNames from './lowercase-header-names';

// NOTE: ResponseMock is a data transfer object
// It should contain only initialization and creation logic
export default class ResponseMock {
    public readonly body?: ResponseMockBodyInit;
    public readonly statusCode: number;
    public readonly headers: Record<string, string>;
    public requestOptions: RequestOptions = null;
    public readonly id: string;

    public constructor (body?: ResponseMockBodyInit, statusCode?: number, headers?: Record<string, string>) {
        validateResponseMockParameters(body, statusCode, headers);

        this.id         = generateUniqueId();
        this.body       = body;
        this.statusCode = statusCode;
        this.headers    = lowerCaseHeaderNames(headers);
    }

    setRequestOptions (opts: RequestOptions): void {
        this.requestOptions = opts;
    }

    public static from (val: object): ResponseMock {
        if (!val)
            return null;

        const body       = val['body'];
        const statusCode = val['statusCode'];
        const headers    = val['headers'];

        return new ResponseMock(body, statusCode, headers);
    }
}
