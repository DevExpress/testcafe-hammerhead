const Session          = require('../../lib/session');
const generateUniqueId = require('../../lib/utils/generate-unique-id');

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
        session.windowId = generateUniqueId();

    return session;
}

module.exports = createSession;
