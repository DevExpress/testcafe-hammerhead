const crypto  = require('crypto');
const Session = require('../../lib/session');

function createWindowId() {
    const buf = crypto.randomBytes(2);
    let res   = '';

    for(const val of buf.values())
        res += val.toString();

    return res;
}

function createSession () {
    const session = new Session(['test/playground/upload-storage']);

    session.getIframePayloadScript = async () => '';
    session.getPayloadScript       = async () => '';
    session.getAuthCredentials      = () => ({});
    session.handleFileDownload      = () => void 0;
    session.handlePageError         = (ctx, err) => {
        console.log(ctx.req.url);
        console.log(err);
    };

    session.allowMultipleWindows = !!global.process.env.allowMultipleWindows;

    if (session.allowMultipleWindows)
        session.windowId = createWindowId();

    return session;
}

module.exports = createSession;
