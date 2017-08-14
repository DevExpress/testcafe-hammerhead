export function preventCaching (res) {
    res.setHeader('cache-control', 'no-cache, no-store, must-revalidate');
    res.setHeader('pragma', 'no-cache');
}

export function respond204 (res) {
    res.statusCode = 204;
    res.end();
}

export function respond404 (res) {
    res.statusCode = 404;
    res.end();
}

export function respond500 (res, err) {
    res.statusCode = 500;
    res.end(err || '');
}

export function respondWithJSON (res, data, skipContentType) {
    if (!skipContentType)
        res.setHeader('content-type', 'application/json');

    // NOTE: GH-105
    preventCaching(res);
    res.end(data ? JSON.stringify(data) : '');
}

export function respondStatic (req, res, resource) {
    if (resource.etag === req.headers['if-none-match']) {
        res.statusCode = 304;
        res.end();
    }

    else {
        res.setHeader('cache-control', 'max-age=30, must-revalidate');
        res.setHeader('etag', resource.etag);
        res.setHeader('content-type', resource.contentType);
        res.end(resource.content);
    }
}

export function fetchBody (r) {
    return new Promise(resolve => {
        const chunks = [];

        r.on('data', chunk => chunks.push(chunk));
        r.on('end', () => resolve(Buffer.concat(chunks)));
    });
}
