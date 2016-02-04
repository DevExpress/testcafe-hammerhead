var urlParser = require('url');

// NOTE: Url rewrite proxied requests (e.g. for iframes), so they will hit our server.
function urlRewriteProxyRequest (req, res, next) {
    var proxiedUrlPartRegExp = /^\/\S+?\/(https?:)/;

    if (proxiedUrlPartRegExp.test(req.url)) {
        // NOTE: Store the destination URL so we can send it back for testing purposes (see GET xhr-test route).
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

    app.post('/get-req-body', function (req, res) {
        var reqData = '';

        req.on('data', function (data) {
            reqData += data;
        });

        req.on('end', function () {
            res.send('<html><head></head><body><div id="result">' + reqData + '</div></body></html>');
        });
    });

    app.get('/get-request-url', function (req, res) {
        res.send('<html><head></head><body><div id="result">' + req.url + '</div></body></html>');
    });

    app.get('/xhr-test/:delay', function (req, res) {
        var delay = req.params.delay || 0;

        setTimeout(function () {
            res.send(req.originalUrl || req.url);
        }, delay);
    });

    app.post('/xhr-origin-header-test/', function (req, res) {
        res.send(req.headers['x-hammerhead|xhr|origin']);
    });

    app.post('/form-data', function (req, res) {
        var chunks = [];

        req.on('data', function (data) {
            chunks.push(data);
        });
        req.on('end', function () {
            res.end(chunks.join(''));
        });
    });
};
