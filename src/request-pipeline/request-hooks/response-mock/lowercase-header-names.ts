export default function (headers?: Record<string, string | string[]>): Record<string, string | string[]> {
    if (!headers)
        return headers;

    const lowerCaseHeaders = {};

    Object.keys(headers).forEach(headerName => {
        lowerCaseHeaders[headerName.toLowerCase()] = headers[headerName];
    });

    return lowerCaseHeaders;
}
