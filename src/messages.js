export const MESSAGE = {
    destConnectionTerminated: 'Failed to perform a request for the resource at <a href="{url}">{url}</a> because connection was unexpectedly terminated.',
    cantResolveUrl:           'Failed to find a DNS-record for the resource at <a href="{url}">{url}</a>.',
    destRequestTimeout:       'Failed to complete a request to <a href="{url}">{url}</a> within the timeout period. The problem may be related to local machine\'s network or firewall settings, server outage, or network problems that make the server inaccessible.'
};

export function getText (template, url) {
    return template.replace(/\{url\}/g, url);
}
