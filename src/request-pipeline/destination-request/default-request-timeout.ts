import { RequestTimeout } from '../../typings/proxy';

const DEFAULT_REQUEST_TIMEOUT = {
    ajax: 2 * 60 * 1000,
    page: 25 * 1000,
};

export function getRequestTimeouts (timeout?: RequestTimeout): RequestTimeout {
    return {
        page: timeout && timeout.page || DEFAULT_REQUEST_TIMEOUT.page,
        ajax: timeout && timeout.ajax || DEFAULT_REQUEST_TIMEOUT.ajax,
    };
}

export default DEFAULT_REQUEST_TIMEOUT;

