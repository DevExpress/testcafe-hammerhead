const crypto  = require('crypto');
const Session = require('../../lib/session');

function createPageId() {
    const buf = crypto.randomBytes(2);
    let res   = '';

    for(const val of buf.values())
        res += val.toString();

    return res;
}

function createSession () {
    const session = new Session(['test/playground/upload-storage']);

    session._getIframePayloadScript = () => '';
    session._getPayloadScript       = () => '';
    session.getAuthCredentials      = () => ({});
    session.handleFileDownload      = () => void 0;
    session.handlePageError         = (ctx, err) => {
        console.log(ctx.req.url);
        console.log(err);
    };

    session.allowMultipleWindows = !!global.process.env.allowMultipleWindows;

    if (session.allowMultipleWindows)
        session.pageId = createPageId();

    return session;
}

module.exports = createSession;
