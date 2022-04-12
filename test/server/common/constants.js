const PAGE_ACCEPT_HEADER        = 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8';
const PROXY_HOSTNAME            = '127.0.0.1';
const SAME_DOMAIN_SERVER_PORT   = 2000;
const CROSS_DOMAIN_SERVER_PORT  = 2002;
const PROXY_PORT_1              = 1836;
const PROXY_PORT_2              = 1837;
const SAME_DOMAIN_SERVER_HOST   = `${PROXY_HOSTNAME}:${SAME_DOMAIN_SERVER_PORT}`;

const TEST_OBJ = {
    prop1: 'value1',
    prop2: 'value2',
};

const EMPTY_PAGE_MARKUP = '<html></html>';

module.exports = {
    PAGE_ACCEPT_HEADER,
    PROXY_HOSTNAME,
    PROXY_PORT_1,
    PROXY_PORT_2,
    SAME_DOMAIN_SERVER_PORT,
    CROSS_DOMAIN_SERVER_PORT,
    TEST_OBJ,
    EMPTY_PAGE_MARKUP,
    SAME_DOMAIN_SERVER_HOST,
};

