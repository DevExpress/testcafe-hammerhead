export const MESSAGE = {
    destConnectionTerminated:         'Failed to perform a request to the resource at <a href="{url}">{url}</a> because of an error.\n{message}',
    cantResolveUrl:                   'Failed to find a DNS-record for the resource at <a href="{url}">{url}</a>.',
    cantEstablishTunnelingConnection: 'Failed to connect to the proxy. Cannot establish tunneling connection to the host at <a href="{url}">{url}</a>.',
    cantEstablishProxyConnection:     'Failed to connect to the proxy host at <a href="{url}">{url}</a>.',
    cantAuthorizeToProxy:             'Failed to authorize to the proxy at <a href="{url}">{url}</a>.',
    destRequestTimeout:               'Failed to complete a request to <a href="{url}">{url}</a> within the timeout period. The problem may be related to local machine\'s network or firewall settings, server outage, or network problems that make the server inaccessible.',
    cantReadFile:                     'Failed to read a file at <a href="{url}">{url}</a> because of the error:\n\n{message}',
    nodeError: {
        'HPE_HEADER_OVERFLOW':      'The request header\'s size exceeds the set limit.\nIt causes an internal Node.js error on parsing this header.\nTo fix the problem, you need to specify the maximum header size via the NODE_OPTIONS=\'--max-http-header-size=...\' environment variable.',
        'HPE_INVALID_HEADER_TOKEN': 'The request contains a header that doesn\'t comply with the specification <a href="https://httpwg.org/specs/rfc7230.html#rfc.section.3.2">https://httpwg.org/specs/rfc7230.html#rfc.section.3.2</a>.\nIt causes an internal Node.js error on parsing this header.\nTo fix the problem, you need to specify the legacy http header parser via the NODE_OPTIONS=\'--insecure-http-parser\' environment variable or change the header name according to the specification.'
    }
};

export function getText (template: string, url: string, message?: string): string {
    let errorStr = template.replace(/\{url\}/g, url);

    if (message)
        errorStr = errorStr.replace(/\{message\}/g, message);

    return errorStr;
}
