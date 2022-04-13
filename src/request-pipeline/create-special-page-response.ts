import IncomingMessageLike from './incoming-message-like';
import BUILTIN_HEADERS from './builtin-header-names';

export default function createSpecialPageResponse () {
    return new IncomingMessageLike({
        headers: {
            [BUILTIN_HEADERS.contentType]:   'text/html',
            [BUILTIN_HEADERS.contentLength]: '0',
        },
    });
}

