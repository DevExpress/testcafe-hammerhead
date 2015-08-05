var Path         = require('path');
var Fs           = require('fs');
var Express      = require('express');
var EventEmitter = require('events').EventEmitter;
var Process      = require('child_process');
var Url          = require('url');
var uuid         = require('node-uuid');
var http         = require('http');
var Promise      = require('promise');

//Const
var PORT              = 1335;
var CROSS_DOMAIN_PORT = 1336;

var BASE_PATH         = __dirname;
var FIXTURES_PATH     = Path.join(BASE_PATH, '/fixtures');
var VIEWS_PATH        = Path.join(BASE_PATH, '/views');
var CUSTOM_SETUP_PATH = Path.join(BASE_PATH, '/custom-setup.js');
var COMPILED_PATH     = Path.join(BASE_PATH, '../../lib/client');

var TEST_PAGE_VIEW   = './test-page-template.ejs';
var DIR_LIST_VIEW    = './dir.ejs';
var TASK_REPORT_VIEW = './task-report.ejs';

var TEST_SETUP_FILE = Path.join(BASE_PATH, 'test-page-setup.js');

//Globals
var appServer         = null;
var crossDomainServer = null;
var pageSetupJs       = null;

//Utils
function fileExists (path) {
    try {
        Fs.statSync(path);

        return true;
    } catch (x) {
        return false;
    }
}

function isDir (path) {
    return Fs.statSync(path).isDirectory();
}

function isHiddenFile (path) {
    path = Path.basename(path);

    return path[0] == '_' || path[0] == '.';
}

function isTestFile (path) {
    var isFixtureDirectory = path.indexOf(FIXTURES_PATH) > -1;

    path = Path.basename(path);

    return isFixtureDirectory && /\.js$/i.test(path);
}

function getTests (path) {
    var tasks = [];
    var i     = 0;

    var res = readDir(path);

    for (i = 0; i < res.files.length; i++)
        tasks.push(Path.join(path, res.files[i]));

    for (i = 0; i < res.dirs.length; i++)
        tasks = tasks.concat(getTests(Path.join(path, res.dirs[i])));

    return tasks;
}

function readDir (path) {
    var result = {
        dirs:  [],
        files: []
    };

    Fs.readdirSync(path).forEach(function (entry) {
        var subpath = Path.join(path, entry);

        if (isDir(subpath))
            result.dirs.push(entry);

        if (isTestFile(subpath))
            result.files.push(entry);

    });

    result.dirs.sort();
    result.files.sort();

    return result;
}

function pathToUrl (path) {
    return path.substr(BASE_PATH.length).replace(/\\/g, '/');
}

function urlToPath (url) {
    return Path.join(BASE_PATH, url);
}

function getFileData (filename) {
    return Fs.readFileSync(filename).toString();
}

function getCustomSetupJs () {
    return fileExists(CUSTOM_SETUP_PATH) ? getFileData(CUSTOM_SETUP_PATH) : '';
}

//Tasks
var tasks = {};

function createTask (path) {
    var tests = getTests(path);
    var uid   = uuid.v4();

    var task = {
        uid:       uid,
        path:      path,
        tests:     tests,
        total:     tests.length,
        completed: 0,
        failed:    0,
        passed:    0,
        reports:   [],
        results:   []
    };

    tasks[uid] = task;

    return task;
}

function onTestComplete (res, testReport, taskUid, userAgent) {
    var task = tasks[taskUid];

    //NOTE: check task have already completed
    if (task.completed === task.total) {
        res.set('Location', pathToUrl(task.path));
        res.send(302);

        return;
    }

    task.results.push({
        name:   task.tests[task.completed],
        result: testReport
    });

    task.reports.push(testReport);
    task.completed++;

    if (testReport.errReport && testReport.errReport.report)
        task.failed++;
    else
        task.passed++;

    var nextTestUrl = task.completed === task.total ? null : pathToUrl(task.tests[task.completed]);

    //NOTE: This route is necessary for use of server.js as module. This route is taking tests report and send for further processing.
    if (!nextTestUrl)
        appServer.emit('tests_complete', task, userAgent);

    res.send(nextTestUrl || '/get-report');
}

function getReport (taskUid) {
    var task = tasks[taskUid];

    var preparedReport = {
        uid:       taskUid,
        path:      pathToUrl(task.path),
        total:     task.total,
        completed: task.completed,
        success:   task.passed,
        failed:    []
    };

    for (var i = 0; i < task.reports.length; i++) {
        var taskReport = task.reports[i];

        if (taskReport.errReport && taskReport.errReport.report) {
            for (var j = 0; j < taskReport.errReport.report.length; j++) {
                var report = taskReport.errReport.report[j];

                report.testPath = pathToUrl(task.tests[i]);
                preparedReport.failed.push(report);
            }
        }
    }

    return preparedReport;
}

function runTests (res, path) {
    var task = createTask(path);

    if (task.tests.length)
        runTest(res, task.tests[0], task.uid);
    else {
        res.set('Location', pathToUrl(path));
        res.send(302);
    }
}

function runTest (res, path, taskUid) {
    var data = {
        testPageSetup:       pageSetupJs,
        testFixture:         getFileData(path),
        customTestPageSetup: getCustomSetupJs(),
        taskUid:             taskUid
    };

    res.render(TEST_PAGE_VIEW, data);
}

//NOTE: Url rewrite proxied requests (e.g. for iframes), so they will hit our server
function urlRewriteProxyRequest (req, res, next) {
    var proxiedUrlPartRegExp = /^\/\S+?\/(https?:)/;

    if (proxiedUrlPartRegExp.test(req.url)) {
        // NOTE: store original URL so we can sent it back for testing purposes (see GET xhr-test route).
        req.originalUrl = req.url;

        var url = req.url.replace(proxiedUrlPartRegExp, '$1');
        //NOTE: create host-relative URL
        var parsedUrl      = Url.parse(url);
        parsedUrl.host     = null;
        parsedUrl.hostname = null;
        parsedUrl.port     = null;
        parsedUrl.protocol = null;
        parsedUrl.slashes  = false;
        req.url            = Url.format(parsedUrl);
    }
    next();
}

var start = function () {
    runCrossDomainServer();

    var app        = Express();
    var currentDir = FIXTURES_PATH;

    appServer = http.createServer(app);

    EventEmitter.call(appServer);

    pageSetupJs = getFileData(TEST_SETUP_FILE);

    app.set('views', VIEWS_PATH);
    app.use(urlRewriteProxyRequest);
    app.use(Express.bodyParser());
    app.use('/hammerhead', Express.static(COMPILED_PATH));

    //Prevent caching
    app.get('/*', function (req, res, next) {
        res.set('cache-control', 'no-cache, no-store, must-revalidate');
        next();
    });


    // Test purposes api
    app.get('/xhr-test/:delay', function (req, res) {
        var delay = req.params.delay || 0;

        setTimeout(function () {
            res.send(req.originalUrl);
        }, delay);
    });

    app.get('/xhr-large-response', function (req, res) {
        var data = new Array(1000);
        res.send(data);
    });

    app.post('/xhr-test/:delay', function (req, res) {
        var delay = req.params.delay || 0;

        setTimeout(function () {
            res.send('');
        }, delay);
    });

    app.get('/wrap-responseText-test/:isJSON', function (req, res) {
        var isJSON       = !!(req.params.isJSON === 'json'),
            responseText = isJSON ?
                           '{tag: "a", location: "location", attribute: {src: "example.com"}}' :
                           '<a href="example.com"><img src="img.png"></a>';

        res.send(responseText);
    });

    app.get('/iframe-test/:delay', function (req, res) {
        var delay = req.params.delay || 0;

        setTimeout(function () {
            res.send('');
        }, delay);
    });

    app.get('/get-script/:script', function (req, res) {
        var script = req.params.script || '';

        res.send(script);
    });

    app.post('/service-msg/:delay', function (req, res) {
        var delay = req.params.delay || 0;

        setTimeout(function () {
            res.send(delay);
        }, delay);
    });

    // Initialization


    app.all('/run-next-test', function (req, res) {
        onTestComplete(res, req.body.report, req.body.taskUid, req.headers['user-agent']);
    });

    app.all('/run-dir', function (req, res) {
        runTests(res, urlToPath(req.query.dir));
    });

    app.all('/get-report', function (req, res) {
        var taskUid = req.query.taskUid;

        res.render(TASK_REPORT_VIEW, getReport(taskUid));
    });

    app.all('/*', function (req, res) {
        var page    = req.params[0];
        var path    = Path.join(BASE_PATH, page);
        var taskUid = req.query.taskUid;

        path = path.replace(/[\\\/]+$/, '');

        res.header('Cache-Control', 'no-cache');

        if (!fileExists(path)) {
            res.send(404);
            return;
        }

        if (!page) {
            res.set('Location', '/fixtures');
            res.send(302);
        }
        else if (isDir(path)) {
            var data = readDir(path);

            data.currentDir = currentDir = Path.basename(path);
            data.currentUrl = pathToUrl(path);
            data.fixtures   = /^\/fixtures(\/|$)/i.test(data.currentUrl);

            res.render(DIR_LIST_VIEW, data);

        }
        else {
            if (isTestFile(path))
                runTest(res, path, taskUid);
            else {
                res.sendfile(path);
            }
        }
    });

    appServer.listen(PORT);
    console.log('Server listens on port ' + PORT);
    Process.exec('start http://localhost:' + PORT);

    return 'http://localhost:' + PORT;
};

function runCrossDomainServer () {
    var app = Express();

    crossDomainServer = http.createServer(app);

    app.use(urlRewriteProxyRequest);
    app.use('/hammerhead', Express.static(COMPILED_PATH));

    //Prevent caching
    app.get('/*', function (req, res, next) {
        res.set('cache-control', 'no-cache, no-store, must-revalidate');
        next();
    });

    app.get('/xhr-test/:delay', function (req, res) {
        var delay = req.params.delay || 0;

        setTimeout(function () {
            res.send(req.url);
        }, delay);
    });

    app.get('/*', function (req, res) {
        var path = Path.join(BASE_PATH, 'data/cross-domain', req.path);

        path = path.replace(/[\\\/]+$/, '');

        res.header('Cache-Control', 'no-cache');

        if (!fileExists(path)) {
            res.send(404);

            return;
        }

        res.set('Content-Type', 'text/html');
        res.send(Fs.readFileSync(path, 'utf8'));
    });

    crossDomainServer.listen(CROSS_DOMAIN_PORT);
}

exports.start = start;

exports.stop = function () {
    appServer.close();
    crossDomainServer.close();
};