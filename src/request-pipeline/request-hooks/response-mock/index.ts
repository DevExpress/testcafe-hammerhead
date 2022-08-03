import RequestOptions from '../../request-options';
import generateUniqueId from '../../../utils/generate-unique-id';
import validateResponseMockParameters from './validate-parameters';
import { ResponseMockBodyInit } from './response-mock-init';
import lowerCaseHeaderNames from './lowercase-header-names';
import isPredicate from '../is-predicate';

// NOTE: ResponseMock is a data transfer object
// It should contain only initialization and creation logic
export default class ResponseMock {
    public readonly body?: ResponseMockBodyInit;
    public readonly statusCode: number;
    public readonly headers: Record<string, string | string[]>;
    public requestOptions: RequestOptions;
    public readonly id: string;
    public isPredicate: boolean;
    public error: Error | null;
    public hasError: boolean;

    public constructor (body?: ResponseMockBodyInit, statusCode?: number, headers?: Record<string, string>) {
        validateResponseMockParameters(body, statusCode, headers);

        this.id          = generateUniqueId();
        this.body        = body;
        this.isPredicate = isPredicate(body);
        this.error       = null;
        this.hasError    = false;

        if (headers)
            this.headers = lowerCaseHeaderNames(headers);

        if (statusCode)
            this.statusCode = statusCode;
    }

    setRequestOptions (opts: RequestOptions): void {
        this.requestOptions = opts;
    }

    public static from (val: object): ResponseMock | null {
        if (!val)
            return null;

        const body       = val['body'];
        const statusCode = val['statusCode'];
        const headers    = val['headers'];

        return new ResponseMock(body, statusCode, headers);
    }
}
