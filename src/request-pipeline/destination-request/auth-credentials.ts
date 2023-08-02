import { ntlm } from 'httpntlm';


const authMethods = ['NTLM', 'Basic'];

function getAuthMethName (res) {
    const authHeader          = res.headers['www-authenticate'] || '';
    const proposedAuthMethods = authHeader.toLowerCase().split(',');

    for (let i = 0; i < authMethods.length; i++) {
        for (let j = 0; j < proposedAuthMethods.length; j++) {
            if (proposedAuthMethods[j].indexOf(authMethods[i].toLowerCase()) !== -1)
                return authMethods[i];
        }
    }

    return '';
}

function addBasicReqInfo (credentials, reqOptions) {
    const authReqStr    = credentials.username + ':' + credentials.password;
    const authReqHeader = 'Basic ' + Buffer.from(authReqStr).toString('base64');

    reqOptions.headers['Authorization'] = authReqHeader;
}

function addNTLMNegotiateMessageReqInfo (credentials, reqOptions, protocolInterface) {
    const agent = new protocolInterface.Agent();

    agent.maxSockets = 1;
    reqOptions.agent = agent;

    reqOptions.headers['connection']    = 'keep-alive';
    reqOptions.headers['Authorization'] = ntlm.createType1Message({
        domain:      credentials.domain || '',
        workstation: credentials.workstation || '',
    });
}

function addNTLMAuthenticateReqInfo (credentials, reqOptions, res) {
    const type2msg = ntlm.parseType2Message(res.headers['www-authenticate']);
    const type3msg = ntlm.createType3Message(type2msg, {
        username:    credentials.username,
        password:    credentials.password,
        domain:      credentials.domain || '',
        workstation: credentials.workstation || '',
    });

    reqOptions.headers['Authorization'] = type3msg;
    reqOptions.headers['connection']    = 'close';
}

function isChallengeMessage (res) {
    return !!ntlm.parseType2Message(res.headers['www-authenticate'], function () {
        return void 0;
    });
}

export function addCredentials (credentials, reqOptions, res, protocolInterface) {
    const authInfo = exports.getAuthInfo(res);

    if (authInfo.method === 'Basic')
        addBasicReqInfo(credentials, reqOptions);
    else if (authInfo.method === 'NTLM') {
        if (!authInfo.isChallengeMessage)
            addNTLMNegotiateMessageReqInfo(credentials, reqOptions, protocolInterface);
        else
            addNTLMAuthenticateReqInfo(credentials, reqOptions, res);
    }
}

export function requiresResBody (res) {
    const authInfo = exports.getAuthInfo(res);

    return !authInfo.isChallengeMessage && authInfo.method.toLowerCase() === 'ntlm';
}

export function getAuthInfo (res) {
    const method = getAuthMethName(res);

    return {
        method:             method,
        isChallengeMessage: method === 'NTLM' ? isChallengeMessage(res) : false,
        canAuthorize:       !!method,
    };
}
