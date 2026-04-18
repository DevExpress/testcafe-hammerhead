import {
    createType1Message,
    createType3Message,
    extractNtlmMessageFromAuthenticateHeader,
    parseType2Message,
} from '@node-ntlm/core';


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
    const ntlmCredentials = getNTLMCredentialsInfo(credentials);

    agent.maxSockets = 1;
    reqOptions.agent = agent;

    reqOptions.headers['connection']    = 'keep-alive';
    reqOptions.headers['Authorization'] = createType1Message(ntlmCredentials);
}

function addNTLMAuthenticateReqInfo (credentials, reqOptions, res) {
    const ntlmCredentials = getNTLMCredentialsInfo(credentials);
    const type2msg        = getType2Message(res);
    const type3msg        = createType3Message(type2msg, {
        username:    credentials.username,
        password:    credentials.password,
        domain:      ntlmCredentials.domain,
        workstation: ntlmCredentials.workstation,
    });

    reqOptions.headers['Authorization'] = type3msg;
    reqOptions.headers['connection']    = 'close';
}

function isChallengeMessage (res) {
    try {
        const type2msg = extractNtlmMessageFromAuthenticateHeader(getAuthenticateHeaderValue(res));

        return !!type2msg && !!parseType2Message(type2msg);
    }
    catch (e) {
        return false;
    }
}

function getNTLMCredentialsInfo (credentials) {
    return {
        domain:      (credentials.domain || '').toUpperCase(),
        workstation: (credentials.workstation || '').toUpperCase(),
    };
}

function getAuthenticateHeaderValue (res) {
    const authHeader = res.headers['www-authenticate'];

    return Array.isArray(authHeader) ? authHeader.join(',') : authHeader;
}

function getType2Message (res) {
    const type2msg = extractNtlmMessageFromAuthenticateHeader(getAuthenticateHeaderValue(res));

    if (!type2msg)
        throw new Error('Cannot find the NTLM challenge message in the WWW-Authenticate header.');

    return parseType2Message(type2msg);
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
