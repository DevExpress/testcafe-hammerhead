import IncomingMessageMock from './incoming-message-mock';

export default function createSpecialPageResponse () {
    return new IncomingMessageMock({
        _body:      Buffer.alloc(0),
        statusCode: 200,
        trailers:   {},
        headers:    {
            'content-type':   'text/html',
            'content-length': '0'
        }
    });
}

