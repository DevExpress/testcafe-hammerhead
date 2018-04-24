import IncomingMessageMock from './incoming-message-mock';

export default function createSpecialPageResponse () {
    return new IncomingMessageMock({
        _body:      new Buffer(0),
        statusCode: 200,
        trailers:   {},
        headers:    {
            'content-type':   'text/html',
            'content-length': '0'
        }
    });
}

