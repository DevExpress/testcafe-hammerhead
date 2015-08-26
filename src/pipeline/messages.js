export const MESSAGE = {
    destServerConnectionTerminated: 'Failed to perform a request for the resource at "{url}" because connection to an origin server was unexpectedly terminated.',
    cantResolveUrl:                 'Failed to find a DNS-record for the resource at "{url}".',
    destServerRequestTimeout:       'The server that hosts the tested page at "{url}" did not respond to a connection request within the timeout period. The problem may be related to local machine\'s network or firewall settings, server outage, or network problems that make the server inaccessible.'
};

export function getText (template, url) {
    return template.replace(/\{url\}/g, url);
}
