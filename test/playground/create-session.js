const Session          = require('../../lib/session');
const generateUniqueId = require('../../lib/utils/generate-unique-id');

function createSession () {
    const opts = {
        allowMultipleWindows: !!global.process.env.allowMultipleWindows
    };

    if (opts.allowMultipleWindows)
        opts.windowId = generateUniqueId();

    const session = new Session(['test/playground/upload-storage'], opts);

    session.getIframePayloadScript = async () => '';
    session.getPayloadScript       = async () => '';
    session.getAuthCredentials      = () => ({});
    session.handleFileDownload      = () => void 0;
    session.handleAttachment        = () => void 0;
    session.handlePageError         = (ctx, err) => {
        console.error(ctx.req.url);
        console.error(err);
    };

    return session;
}

module.exports = createSession;
