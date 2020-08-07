export const MESSAGE = {
    destConnectionTerminated:         'Failed to perform a request to the resource at <a href="{url}">{url}</a> because of an error.\n{message}',
    cantResolveUrl:                   'Failed to find a DNS-record for the resource at <a href="{url}">{url}</a>.',
    cantEstablishTunnelingConnection: 'Failed to connect to the proxy. Cannot establish tunneling connection to the host at <a href="{url}">{url}</a>.',
    cantEstablishProxyConnection:     'Failed to connect to the proxy host at <a href="{url}">{url}</a>.',
    cantAuthorizeToProxy:             'Failed to authorize to the proxy at <a href="{url}">{url}</a>.',
    destRequestTimeout:               'Failed to complete a request to <a href="{url}">{url}</a> within the timeout period. The problem may be related to local machine\'s network or firewall settings, server outage, or network problems that make the server inaccessible.',
    cantReadFile:                     'Failed to read a file at <a href="{url}">{url}</a> because of the error:\n\n{message}',
    nodeError: {
        'HPE_HEADER_OVERFLOW':      'The request header\'s size is {headersSize} bytes which exceeds the set limit.\nIt causes an internal Node.js error on parsing this header.\nTo fix the problem, you need to add the \'--max-http-header-size=...\' flag to the \'NODE_OPTIONS\' environment variable:\n\nmacOS, Linux (bash, zsh)\nexport NODE_OPTIONS=\'--max-http-header-size={recommendedMaxHeadersSize}\'\n\nWindows (powershell)\n$env:NODE_OPTIONS=\'--max-http-header-size={recommendedMaxHeadersSize}\'\n\nWindows (cmd)\nset NODE_OPTIONS=\'--max-http-header-size={recommendedMaxHeadersSize}\'\n\nand then start your tests.',
        'HPE_INVALID_HEADER_TOKEN': 'The request contains a header that doesn\'t comply with the specification <a href="https://tools.ietf.org/html/rfc7230#section-3.2.4">https://tools.ietf.org/html/rfc7230#section-3.2.4</a>.\nIt causes an internal Node.js error on parsing this header.\nTo fix the problem, you need to add the \'--insecure-http-parser\' flag to the \'NODE_OPTIONS\' environment variable:\n\nmacOS, Linux (bash, zsh)\nexport NODE_OPTIONS=\'--insecure-http-parser\'\n\nWindows (powershell)\n$env:NODE_OPTIONS=\'--insecure-http-parser\'\n\nWindows (cmd)\nset NODE_OPTIONS=\'--insecure-http-parser\'\n\nand then start your tests.'
    }
};

class MessageParameters {
    url:                        string;
    message?:                   string;
    headersSize?:               string;
    recommendedMaxHeadersSize?: string;
}

export function getText (template: string, parameters: MessageParameters): string {
    let errorStr = template;

    for (const [parameterName, parameterValue] of Object.entries(parameters)) {
        errorStr = errorStr.replace(new RegExp(`{${parameterName}}`, 'g'), parameterValue);
    }

    return errorStr;
}
