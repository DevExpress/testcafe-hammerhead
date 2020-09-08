const Session          = require('../../lib/session');
const generateUniqueId = require('../../lib/utils/generate-unique-id');

function createSession () {
    const options = {
        allowMultipleWindows: !!global.process.env.allowMultipleWindows
    };

    const session = new Session(['test/playground/upload-storage'], options);

    session.getIframePayloadScript = async () => '';
    session.getPayloadScript       = async () => '';
    session.getAuthCredentials     = () => ({});
    session.handleFileDownload     = () => void 0;
    session.handlePageError        = (ctx, err) => {
        console.log(ctx.req.url);
        console.log(err);
    };

    return session;
}

module.exports = createSession;
