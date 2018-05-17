import Agent from 'yakaa';
import LRUCache from 'lru-cache';
import tunnel from 'tunnel-agent';

// Const
const SSL3_HOST_CACHE_SIZE = 1000;

const TYPE = {
    SSL3: 'SSL3',
    TLS:  'TLS',
    HTTP: 'HTTP'
};


// Static
const ssl3HostCache = new LRUCache({ max: SSL3_HOST_CACHE_SIZE });

// NOTE: We need an agent with proper keep-alive behavior. Such an agent has landed in Node 0.12. Since we
// still support Node 0.10, we will use a third-party agent that is the extraction of Node 0.12 Agent code.
const agents = {
    [TYPE.SSL3]: {
        instance:       null,
        Ctor:           Agent.SSL,
        secureProtocol: 'SSLv3_method'
    },

    [TYPE.TLS]: {
        instance: null,
        Ctor:     Agent.SSL
    },

    [TYPE.HTTP]: {
        instance: null,
        Ctor:     Agent
    }
};


// Utils
function getAgent (type) {
    const agent = agents[type];

    if (!agent.instance) {
        agent.instance = new agent.Ctor({
            keepAlive:      true,
            secureProtocol: agent.secureProtocol
        });
    }

    return agent.instance;
}

function isSSLProtocolErr (err) {
    return err.message && err.message.includes('SSL routines');
}


// API
export function assign (reqOpts) {
    const proxy = reqOpts.proxy;

    if (proxy && reqOpts.protocol === 'https:') {
        reqOpts.agent = tunnel.httpsOverHttp({ proxy });

        return;
    }

    let type = void 0;

    if (reqOpts.protocol === 'http:')
        type = TYPE.HTTP;

    else if (ssl3HostCache.get(reqOpts.host))
        type = TYPE.SSL3;

    else
        type = TYPE.TLS;

    reqOpts.agent = getAgent(type);
}

export function shouldRegressHttps (reqErr, reqOpts) {
    return reqOpts.agent === agents[TYPE.TLS] && isSSLProtocolErr(reqErr);
}

export function regressHttps (reqOpts) {
    ssl3HostCache.set(reqOpts.host, true);
    reqOpts.agent = getAgent(TYPE.SSL3);
}

// NOTE: Since our agents are keep-alive, we need to manually reset connections when we
// switch between servers in tests.
export function resetKeepAliveConnections () {
    Object.keys(agents).forEach(type => {
        const agent = agents[type];

        if (agent.instance)
            agent.instance.destroy();

        agent.instance = null;
    });
}
