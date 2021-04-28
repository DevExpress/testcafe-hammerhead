import { IncomingHttpHeaders } from 'http';

export default function (headers: IncomingHttpHeaders): Record<string, string | string[]> {
    const lowerCaseHeaders = {};

    Object.keys(headers).forEach(headerName => {
        lowerCaseHeaders[headerName.toLowerCase()] = headers[headerName];
    });

    return lowerCaseHeaders;
}
