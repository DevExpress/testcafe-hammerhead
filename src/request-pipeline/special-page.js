export function getResponse () {
    return {
        statusCode: 200,
        trailers:   {},
        headers:    {
            'content-type':   'text/html',
            'content-length': '0'
        }
    };
}

export function getBody () {
    return new Buffer(0);
}
