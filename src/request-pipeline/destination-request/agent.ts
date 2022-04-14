import RequestOptions from '../request-options';
import http from 'http';
import https from 'https';
import LRUCache from 'lru-cache';
import tunnel from 'tunnel-agent';

const SSL3_HOST_CACHE_SIZE = 1000;

/* eslint-disable no-unused-vars */
enum TYPE { // eslint-disable-line no-shadow
    SSL3 = 'SSL3',
    TLS = 'TLS',
    HTTP = 'HTTP'
}
/* eslint-enable no-unused-vars */

const ssl3HostCache = new LRUCache({ max: SSL3_HOST_CACHE_SIZE });

const agents = {
    [TYPE.SSL3]: {
        instance:       null,
        Ctor:           https.Agent,
        secureProtocol: 'SSLv3_method',
    },

    [TYPE.TLS]: {
        instance: null,
        Ctor:     https.Agent,
    },

    [TYPE.HTTP]: {
        instance: null,
        Ctor:     http.Agent,
    },
};


// Utils
function getAgent (type: string) {
    const agent = agents[type];

    if (!agent.instance) {
        // @ts-ignore: Cannot use 'new' with an expression whose type lacks a call or construct signature.
        agent.instance = new agent.Ctor({
            keepAlive:      true,
            secureProtocol: agent.secureProtocol,
        });
    }

    return agent.instance;
}

function isSSLProtocolErr (err: Error): boolean {
    return !!err.message && err.message.includes('SSL routines');
}


// API
export function assign (reqOpts: RequestOptions): void {
    const proxy = reqOpts.proxy;

    if (proxy && reqOpts.protocol === 'https:') {
        reqOpts.agent = tunnel.httpsOverHttp({
            proxy,
            rejectUnauthorized: false,
        });

        return;
    }

    let type = '';

    if (reqOpts.protocol === 'http:')
        type = TYPE.HTTP;

    else if (ssl3HostCache.get(reqOpts.host))
        type = TYPE.SSL3;

    else
        type = TYPE.TLS;

    reqOpts.agent = getAgent(type);
}

export function shouldRegressHttps (reqErr: Error, reqOpts: RequestOptions): boolean {
    return reqOpts.agent === agents[TYPE.TLS] && isSSLProtocolErr(reqErr);
}

export function regressHttps (reqOpts: RequestOptions): void {
    ssl3HostCache.set(reqOpts.host, true);
    reqOpts.agent = getAgent(TYPE.SSL3);
}

// NOTE: Since our agents are keep-alive, we need to manually reset connections when we
// switch between servers in tests.
export function resetKeepAliveConnections (): void {
    Object.keys(agents).forEach(type => {
        const agent = agents[type];

        if (agent.instance)
            agent.instance.destroy();

        agent.instance = null;
    });
}
