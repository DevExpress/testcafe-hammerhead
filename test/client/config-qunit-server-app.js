var urlParser = require('url');

// NOTE: Url rewrite proxied requests (e.g. for iframes), so they will hit our server.
function urlRewriteProxyRequest (req, res, next) {
    var proxiedUrlPartRegExp = /^\/\S+?\/(https?:)/;

    if (proxiedUrlPartRegExp.test(req.url)) {
        // NOTE: Store the original URL so we can send it back for testing purposes (see GET xhr-test route).
        req.originalUrl = req.url;

        var url = req.url.replace(proxiedUrlPartRegExp, '$1');

        // NOTE: Create host-relative URL.
        var parsedUrl = urlParser.parse(url);

        parsedUrl.host     = null;
        parsedUrl.hostname = null;
        parsedUrl.port     = null;
        parsedUrl.protocol = null;
        parsedUrl.slashes  = false;
        req.url            = urlParser.format(parsedUrl);
    }

    next();
}

module.exports = function (app) {
    app.use(urlRewriteProxyRequest);

    app.get('/xhr-large-response', function (req, res) {
        var data = new Array(1000);

        res.send(data);
    });

    app.all('/get-script/:script', function (req, res) {
        var script = req.params.script || '';

        res.send(script);
    });

    app.post('/service-msg/:delay', function (req, res) {
        var delay = req.params.delay || 0;

        setTimeout(function () {
            res.send(delay);
        }, delay);
    });

    app.get('/xhr-test/:delay', function (req, res) {
        var delay = req.params.delay || 0;

        setTimeout(function () {
            res.send(req.originalUrl || req.url);
        }, delay);
    });
};
