var urlParser     = require('url');
var fs            = require('fs');
var CookieJar     = require('tough-cookie').CookieJar;
var processScript = require('../../lib/processing/script').processScript;

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

function fetchContent (req) {
    return new Promise(resolve => {
        const chunks = [];

        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    });
}

function processServerScript (script) {
    return processScript(script, true, false);
}

module.exports = function (app) {
    app.use('/sessionId!c/*', function (req, res, next) {
        res.setHeader('service-worker-allowed', '/');
        next();
    });

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

    app.get('/transport-worker.js', function (req, res) {
        const patchRegExp  = /(\s*)xhr\.send\(JSON\.stringify\(msg\)\);/;
        const patchPattern = [
            '\n',
            '// QUnit patch start',
            'msg.retriesCount = (msg.retriesCount || 0) + 1;',
            '// QUnit patch end',
            '$&\n',
            '// QUnit patch start',
            'if (msg.rejectForTest || msg.rejectForTestOnce && msg.retriesCount === 1)',
            '    xhr.abort();',
            '// QUnit patch end',
        ].join('$1');

        res
            .set('content-type', 'application/javascript')
            .send(fs.readFileSync('./lib/client/transport-worker.js').toString().replace(patchRegExp, patchPattern));
    });

    app.get('/worker-hammerhead.js', function (req, res) {
        res
            .set('content-type', 'application/javascript')
            .send(fs.readFileSync('./lib/client/worker-hammerhead.js'));
    });

    app.post('/service-msg', function (req, res) {
        fetchContent(req)
            .then(body => {
                var msg = JSON.parse(body);

                if (msg.rejectForTest500) {
                    return res
                        .status(500)
                        .send('An error occurred!!!');
                }

                setTimeout(() => res.send(JSON.stringify(msg)), msg.delay || 0);
            });
    });

    app.get('/xhr-test/:delay', (req, res) => setTimeout(() => {
        res.send(req.originalUrl || req.url);
    }, req.params.delay || 0));

    app.get('/xhr-with-sync-cookie/', function (req, res) {
        res.setHeader('set-cookie', 's|sessionId|hello|example.com|%2F||1fckm5lnl|=world;path=/');
        res.setHeader('cache-control', 'no-cache, no-store, must-revalidate');
        res.setHeader('pragma', 'no-cache');
        res.send();
    });

    app.get('/cors/', (req, res) => res
        .set('access-control-allow-origin', req.headers.origin)
        .send());

    app.get('/:variable/script-url.js', (req, res) => res
        .set('content-type', 'application/javascript')
        .send(processServerScript('self.' + req.params.variable + ' = "' + req.originalUrl + '";')));

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
        fetchContent(req)
            .then(body => {
                res.end(body);
            });
    });

    app.post('/echo-request-body', function (req, res) {
        res.json(req.body);
    });

    app.all('/echo-request-headers', function (req, res) {
        res.json(req.headers);
    });

    app.post('/echo-request-body-in-response-headers', function (req, res) {
        fetchContent(req)
            .then(body => {
                var headers = JSON.parse(body);

                res.writeHead(200, headers);
                res.end();
            });
    });

    app.post('/set-cookie-msg/', function (req, res) {
        fetchContent(req)
            .then(body => {
                var msg       = JSON.parse(body);
                var userAgent = req.headers['user-agent'];

                if (!cookies[userAgent])
                    cookies[userAgent] = new CookieJar();

                for (var i = 0; i < msg.queue.length; i++) {
                    cookies[userAgent].setCookieSync(msg.queue[i].cookie, 'https://example.com/', {
                        http:        false,
                        ignoreError: true,
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
        var image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUA' +
                                'AAAJcEhZcwAADsMAAA7DAcdvqGQAAAAMSURBVBhXY9j6TBYABAwBuZFzS6sAAAAASUVORK5CYII=', 'base64');

        setTimeout(function () {
            res.set('content-type', 'image/png');

            if (!req.query.expires) {
                res.set('cache-control', 'no-cache, no-store, must-revalidate');
                res.set('pragma', 'no-cache');
            }
            else
                res.set('expires', req.query.expires);

            res.send(image);
        }, req.query.timeout || 0);
    });

    app.get('/destroy-connection', function (req, res) {
        res.destroy();
    });

    app.get('/sub-dir/eval-dynamic-import.js', (req, res) => {
        res
            .set('content-type', 'application/javascript')
            .send(fs.readFileSync('./test/client/data/import-script/sub-dir/eval-dynamic-import.js'));
    });

    app.get('/sub-dir/gh2122.js', (req, res) => {
        res
            .set('content-type', 'application/javascript')
            .send(fs.readFileSync('./test/client/data/import-script/sub-dir/gh2122.js'));
    });
};
