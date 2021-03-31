import { ResponseMockBodyInit } from './response-mock-init';

const INVALID_BODY_PARAMETER_TYPES = ['number', 'boolean'];

const INVALID_STATUS_CODE_MESSAGE = 'Invalid status code. It should be a number that is greater than 100 and less than 999.';

function validateBody (body?: ResponseMockBodyInit): void {
    const bodyType = typeof body;

    if (INVALID_BODY_PARAMETER_TYPES.includes(bodyType))
        throw new TypeError(`The 'body' parameter has an invalid type - ${bodyType}.`);
}

function validateStatusCode (statusCode?: number): void {
    if (statusCode === void 0)
        return;

    if (typeof statusCode !== 'number')
        throw new TypeError(INVALID_STATUS_CODE_MESSAGE);

    // NOTE: for Infinity case
    statusCode |= 0;

    if (statusCode < 100 || statusCode > 999)
        throw new TypeError(INVALID_STATUS_CODE_MESSAGE);
}

function validateHeaders (headers?: Record<string, string>): void {
    if (headers === void 0)
        return;

    if (typeof headers !== 'object')
        throw new TypeError("Invalid type of the 'headers' parameter. It should be an object.");
}

export default function (body?: ResponseMockBodyInit, statusCode?: number, headers?: Record<string, string>): void {
    validateBody(body);
    validateStatusCode(statusCode);
    validateHeaders(headers);
}
