var urlParser = require('url');
var fs        = require('fs');
var CookieJar = require('tough-cookie').CookieJar;

var unchangeableUrlSession = 'unchangeableUrlSession';
var cookies                = {};

// NOTE: Url rewrite proxied requests (e.g. for iframes), so they will hit our server.
function urlRewriteProxyRequest (req, res, next) {
    var proxiedUrlPartRegExp = /^\/\S+?\/(https?:)/;

    if (proxiedUrlPartRegExp.test(req.url) && req.url.indexOf(unchangeableUrlSession) === -1) {
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

    app.get('/' + unchangeableUrlSession + '!i/*', function (req, res) {
        // NOTE: give some time for PageNavigationWatch notification delivering
        setTimeout(function () {
            res.send(fs.readFileSync('./test/client/data/page-navigation-watch/location-subject.html').toString());
        }, 100);
    });

    app.get('/' + unchangeableUrlSession + '!if/*', function (req, res) {
        // NOTE: give some time for PageNavigationWatch notification delivering
        setTimeout(function () {
            res.send(fs.readFileSync('./test/client/data/page-navigation-watch/location-subject.html').toString());
        }, 100);
    });

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

    app.post('/cookie-sync/:delay', function (req, res) {
        var delay = req.params.delay || 0;

        setTimeout(function () {
            res.status(204).send();
        }, delay);
    });

    app.post('/cookie-sync-fail/', function (req, res) {
        setTimeout(function () {
            res.status(404).send();
        }, 100);
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

    app.get('/xhr-with-sync-cookie/', function (req, res) {
        res.setHeader('set-cookie', 's|sessionId|hello|example.com|%2F||1fckm5lnl=world;path=/');
        res.setHeader('cache-control', 'no-cache, no-store, must-revalidate, max-age=0');
        res.send();
    });

    app.get('/xhr-222/', function (req, res) {
        res.statusCode = 222;
        res.send('true');
    });

    app.get('/redirect/', function (req, res) {
        res.statusCode = 302;
        res.setHeader('location', req.originalUrl.replace('redirect/', 'xhr-large-response'));
        res.send();
    });

    app.get('/respond-500', function (req, res) {
        res.statusCode = 500;
        res.send('Server error');
    });

    app.get('/close-request', function (req) {
        req.destroy();
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

    app.post('/echo-request-body', function (req, res) {
        res.json(req.body);
    });

    app.all('/echo-request-headers', function (req, res) {
        res.json(req.headers);
    });

    app.post('/set-cookie-msg/', function (req, res) {
        var chunks = [];

        req.on('data', function (chunk) {
            chunks.push(chunk);
        });

        req.on('end', function () {
            var msg       = JSON.parse(Buffer.concat(chunks).toString());
            var userAgent = req.headers['user-agent'];

            if (!cookies[userAgent])
                cookies[userAgent] = new CookieJar();

            for (var i = 0; i < msg.queue.length; i++) {
                cookies[userAgent].setCookieSync(msg.queue[i].cookie, 'https://example.com/', {
                    http:        false,
                    ignoreError: true
                });
            }

            res.status(204).send();
        });
    });

    app.get('/get-cookies/', function (req, res) {
        var pageMarkup = fs.readFileSync('./test/client/data/cookie/get-cookie.html').toString();
        var userAgent  = req.headers['user-agent'];
        var cookieStr  = '';

        if (cookies[userAgent])
            cookieStr = cookies[userAgent].getCookieStringSync('https://example.com/', { http: false });

        res.send(pageMarkup.replace(/\$\{cookies}/, cookieStr));

        delete cookies[userAgent];
    });

    // We should add routes for iframe loading in IE 11 ("location" property test) (GH-1613)
    var iframeLocationUrlCallback = function (req, res, next) {
        var locationPossibleValues = ['null', 'undefined', '[object Object]', 'some-path'];

        if (locationPossibleValues.includes(req.params.url))
            res.send(req.params.url);
        else
            next();
    };

    app.get('/fixtures/sandbox/code-instrumentation/:url', iframeLocationUrlCallback);

    app.get('/:url', iframeLocationUrlCallback);

    app.get('/image.png', function (req, res) {
        var promise = null;

        if (req.query.timeout) {
            promise = new Promise(function (resolve) {
                setTimeout(resolve, req.query.timeout);
            });
        }
        else
            promise = Promise.resolve();

        promise
            .then(function () {
                res
                    .set('content-type', 'image/png')
                    .set('cache-control', 'no-cache, no-store, must-revalidate')
                    .set('pragma', 'no-cache')
                    .send(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAAAXNSR0I' +
                                      'Ars4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqG' +
                                      'QAAAAMSURBVBhXY9j6TBYABAwBuZFzS6sAAAAASUVORK5CYII=', 'base64'));
            });
    });
};
