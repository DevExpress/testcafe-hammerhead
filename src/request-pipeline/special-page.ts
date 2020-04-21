import IncomingMessageMock from './incoming-message-mock';
import BUILTIN_HEADERS from './builtin-header-names';

export default function createSpecialPageResponse () {
    return new IncomingMessageMock({
        _body:      Buffer.alloc(0),
        statusCode: 200,
        trailers:   {},
        headers:    {
            [BUILTIN_HEADERS.contentType]:   'text/html',
            [BUILTIN_HEADERS.contentLength]: '0'
        }
    });
}

