import IncomingMessageLike, { IncomingMessageLikeInitOptions } from '../../incoming-message-like';
import ResponseMock from './index';
import BUILTIN_HEADERS from '../../builtin-header-names';
import lowerCaseHeaderNames from './lowercase-header-names';
import { JSON_MIME } from '../../../utils/content-type';
import { ResponseMockBodyInit } from './response-mock-init';
import * as setBodyMethod from './set-body-method';

const PAGE_CONTENT_TYPE = 'text/html; charset=utf-8';
const EMPTY_PAGE_HTML   = '<html><body></body></html>';

function getContentType (body?: ResponseMockBodyInit): string {
    if (body !== null && typeof body === 'object')
        return JSON_MIME;

    return PAGE_CONTENT_TYPE;
}

export default async function (mock: ResponseMock): Promise<IncomingMessageLike> {
    let response = {
        headers:    { [BUILTIN_HEADERS.contentType]: getContentType(mock.body) },
        statusCode: mock.statusCode
    } as IncomingMessageLikeInitOptions;

    if (mock.headers)
        response.headers = Object.assign(response.headers, mock.headers);

    if (mock.body === void 0)
        response.body = EMPTY_PAGE_HTML;
    else if (typeof mock.body === 'function') {
        setBodyMethod.add(response);

        response = Object.assign(response, await mock.body(mock.requestOptions, response));

        setBodyMethod.remove(response);
    }
    else
        response.body = mock.body;

    response.headers = lowerCaseHeaderNames(response.headers);

    return new IncomingMessageLike(response);
}
