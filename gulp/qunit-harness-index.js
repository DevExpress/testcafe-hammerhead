'use strict';

var _inherits = require('babel-runtime/helpers/inherits').default;

var _classCallCheck = require('babel-runtime/helpers/class-call-check').default;

var _regeneratorRuntime = require('babel-runtime/regenerator').default;

var _Object$keys = require('babel-runtime/core-js/object/keys').default;

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default').default;

var _interopRequireWildcard = require('babel-runtime/helpers/interop-require-wildcard').default;

exports.__esModule = true;

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _mustache = require('mustache');

var _mustache2 = _interopRequireDefault(_mustache);

var _hoganExpress = require('hogan-express');

var _hoganExpress2 = _interopRequireDefault(_hoganExpress);

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _utilsFs = require('./utils/fs');

var fs = _interopRequireWildcard(_utilsFs);

var _utilsReadDir = require('./utils/read-dir');

var _utilsReadDir2 = _interopRequireDefault(_utilsReadDir);

var _utilsGetTests = require('./utils/get-tests');

var _utilsGetTests2 = _interopRequireDefault(_utilsGetTests);

var _utilsPathToUrl = require('./utils/path-to-url');

var _utilsPathToUrl2 = _interopRequireDefault(_utilsPathToUrl);

var _events = require('events');

var _saucelabsSaucelabs = require('./saucelabs/saucelabs');

var saucelabs = _interopRequireWildcard(_saucelabsSaucelabs);

var _cli = require('./cli');

var cli = _interopRequireWildcard(_cli);

var _saucelabsReport = require('./saucelabs/report');

var _saucelabsReport2 = _interopRequireDefault(_saucelabsReport);

var _cliReport = require('./cli/report');

var _cliReport2 = _interopRequireDefault(_cliReport);

var VIEWS_PATH = _path2.default.join(__dirname, 'views');
var GLOBALS_TEMPLATE_PATH = _path2.default.join(__dirname, 'templates/globals.mustache.js');
var QUNIT_SETUP_TEMPLATE_PATH = _path2.default.join(__dirname, 'templates/qunit-setup.mustache');
var STORE_GLOBALS_TEMPLATE_PATH = _path2.default.join(__dirname, 'templates/store-globals.mustache');
var RESTORE_GLOBALS_TEMPLATE_PATH = _path2.default.join(__dirname, 'templates/restore-globals.mustache');

//Globals
var contentTypes = {
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.html': 'text/html',
    'default': 'text/html'
};

//Routes
function onPingRequest(req, res) {
    var delay = req.params.delay || 0;

    setTimeout(function () {
        return res.send(delay);
    }, delay);
}

function preventCaching(req, res, next) {
    res.set('cache-control', 'no-cache, no-store, must-revalidate');
    next();
}

function onScriptRequest(req, res, filePath) {
    var content;
    return _regeneratorRuntime.async(function onScriptRequest$(context$1$0) {
        while (1) switch (context$1$0.prev = context$1$0.next) {
            case 0:
                context$1$0.next = 2;
                return _regeneratorRuntime.awrap(fs.readfile(filePath));

            case 2:
                content = context$1$0.sent;

                res.setHeader('content-type', contentTypes['.js']);
                res.send(content);

            case 5:
            case 'end':
                return context$1$0.stop();
        }
    }, null, this);
}

function onCssRequest(req, res, filePath) {
    var content;
    return _regeneratorRuntime.async(function onCssRequest$(context$1$0) {
        while (1) switch (context$1$0.prev = context$1$0.next) {
            case 0:
                context$1$0.next = 2;
                return _regeneratorRuntime.awrap(fs.readfile(filePath));

            case 2:
                content = context$1$0.sent;

                res.setHeader('content-type', contentTypes['.css']);
                res.send(content);

            case 5:
            case 'end':
                return context$1$0.stop();
        }
    }, null, this);
}

function getFile(res, filePath) {
    return _regeneratorRuntime.async(function getFile$(context$1$0) {
        while (1) switch (context$1$0.prev = context$1$0.next) {
            case 0:
                res.set('Content-Type', contentTypes[_path2.default.extname(filePath)]);
                context$1$0.t0 = res;
                context$1$0.next = 4;
                return _regeneratorRuntime.awrap(fs.readfile(filePath));

            case 4:
                context$1$0.t1 = context$1$0.sent;
                context$1$0.t0.send.call(context$1$0.t0, context$1$0.t1);

            case 6:
            case 'end':
                return context$1$0.stop();
        }
    }, null, this);
}

//QUnitServer

var QUnitServer = (function (_EventEmitter) {
    _inherits(QUnitServer, _EventEmitter);

    function QUnitServer() {
        _classCallCheck(this, QUnitServer);

        _EventEmitter.call(this);

        this.serverPort = 1335;
        this.crossDomainServerPort = 1336;
        this.hostname = '';
        this.crossDomainHostname = '';

        this.basePath = '';

        this.app = _express2.default();
        this.crossDomainApp = _express2.default();

        this.appServer = null;
        this.crossDomainAppServer = null;

        this.app.engine('mustache', _hoganExpress2.default);
        this.app.set('views', VIEWS_PATH);
        this.app.set('view engine', 'mustache');

        this.app.use(_express2.default.static(_path2.default.join(__dirname, '/vendor')));
        this.crossDomainApp.use(_express2.default.static(_path2.default.join(__dirname, '/vendor')));
        this.app.use(_bodyParser2.default.json());

        this.globalsTemplate = fs.readfileSync(GLOBALS_TEMPLATE_PATH, 'utf-8');
        this.qunitSetupTemplate = fs.readfileSync(QUNIT_SETUP_TEMPLATE_PATH, 'utf-8');
        this.storeGlobalsTemplate = fs.readfileSync(STORE_GLOBALS_TEMPLATE_PATH, 'utf-8');
        this.restoreGlobalsTemplate = fs.readfileSync(RESTORE_GLOBALS_TEMPLATE_PATH, 'utf-8');

        this.testResources = {
            scripts: [],
            css: []
        };

        this.beforeCallback = null;
        this.afterCallback = null;

        this.tasks = {};
        this.tasksCounter = 0;
        this.pendingTests = [];

        this.sauselabsSettings = null;
        this.sauselabsTunnel = null;
    }

    //Init

    QUnitServer.prototype._createServers = function _createServers() {
        this.localhostname = 'http://localhost:' + this.serverPort;

        var hostname = process.env.TRAVIS ? 'http://' + _os2.default.hostname() + ':' : 'http://localhost:';

        this.hostname = hostname + this.serverPort;

        console.log('in _createServers method', this.hostname);
        this.crossDomainHostname = hostname + this.crossDomainServerPort;

        this.appServer = this.app.listen(this.serverPort);
        this.crossDomainAppServer = this.crossDomainApp.listen(this.crossDomainServerPort);
    };

    QUnitServer.prototype._setupRoutes = function _setupRoutes() {
        var _this = this;

        //Prevent caching
        this.app.get('/*', preventCaching);
        this.crossDomainApp.get('/*', preventCaching);

        this.app.get('/', function (req, res) {
            return res.redirect('/fixtures');
        });
        this.app.get('/start', function (req, res) {
            console.log('in /start route', _this.hostname + '/run-tests');
            return res.redirect(302, _this.hostname + '/run-tests');
        });
        this.app.get('/run-tests', function (req, res) {
            return _this._runTests(req, res, _this.pendingTests.map(function (item) {
                return item;
            }));
        });
        this.app.get('/run-dir/:dir', function (req, res) {
            return _this._runDir(req, res, decodeURIComponent(req.params['dir']));
        });
        this.app.post('/test-done/:id', function (req, res) {
            return _this._onTestDone(res, req.body.report, req.params['id']);
        });
        this.app.get('/report/:id', function (req, res) {
            return _this._onReportRequest(res, req.params['id']);
        });

        this.app.get('/test-resource(/)?*', function (req, res) {
            getFile(res, _path2.default.join(_path2.default.dirname(req.query['base']), req.query['filePath']));
        });
        this.crossDomainApp.get('/test-resource(/:name)?', function (req, res) {
            getFile(res, _path2.default.join(_path2.default.dirname(req.query['base']), req.query['filePath']));
        });

        this.app.get('/fixtures', function (req, res) {
            return _this._onResourceRequest(req, res, _this.basePath);
        });
        this.app.get('/fixtures/*', function (req, res) {
            return _this._onResourceRequest(req, res, _this.basePath);
        });

        this.app.all('/ping/:delay', onPingRequest);
        this.crossDomainApp.all('/ping/:delay', onPingRequest);
    };

    QUnitServer.prototype._registerScript = function _registerScript(script) {
        this.testResources.scripts.push(script);

        this.app.get(script.src, function (req, res) {
            return onScriptRequest(req, res, script.path);
        });
        this.crossDomainApp.get(script.src, function (req, res) {
            return onScriptRequest(req, res, script.path);
        });
    };

    QUnitServer.prototype._registerCss = function _registerCss(css) {
        this.testResources.css.push(css);

        this.app.get(css.src, function (req, res) {
            return onCssRequest(req, res, css.path);
        });
        this.crossDomainApp.get(css.src, function (req, res) {
            return onCssRequest(req, res, css.path);
        });
    };

    //Request handlers

    QUnitServer.prototype._onResourceRequest = function _onResourceRequest(req, res, basePath) {
        var reqPath, resourcePath, stats, _ref, dirs, files;

        return _regeneratorRuntime.async(function _onResourceRequest$(context$2$0) {
            while (1) switch (context$2$0.prev = context$2$0.next) {
                case 0:
                    reqPath = req.params[0] || '';
                    resourcePath = _path2.default.join(basePath, reqPath);
                    context$2$0.next = 4;
                    return _regeneratorRuntime.awrap(fs.stat(resourcePath));

                case 4:
                    stats = context$2$0.sent;

                    if (stats) {
                        context$2$0.next = 7;
                        break;
                    }

                    return context$2$0.abrupt('return', res.sendStatus(404));

                case 7:
                    if (!stats.isDirectory()) {
                        context$2$0.next = 17;
                        break;
                    }

                    context$2$0.next = 10;
                    return _regeneratorRuntime.awrap(_utilsReadDir2.default(resourcePath));

                case 10:
                    _ref = context$2$0.sent;
                    dirs = _ref.dirs;
                    files = _ref.files;

                    dirs = dirs.map(function (dir) {
                        return { path: dir };
                    });

                    files = files.map(function (file) {
                        return { path: file };
                    });

                    res.locals = {
                        currentDir: req.path.replace(/^\//, ''),
                        encodedCurrentDir: encodeURIComponent(req.path.replace(/^\//, '')),
                        dirs: dirs,
                        files: files
                    };

                    return context$2$0.abrupt('return', res.render('dir'));

                case 17:
                    if (!(resourcePath.indexOf('-test.js') > -1)) {
                        context$2$0.next = 21;
                        break;
                    }

                    context$2$0.next = 20;
                    return _regeneratorRuntime.awrap(this._runTest(res, resourcePath, req.query['taskId']));

                case 20:
                    return context$2$0.abrupt('return', context$2$0.sent);

                case 21:
                    context$2$0.next = 23;
                    return _regeneratorRuntime.awrap(getFile(res, resourcePath));

                case 23:
                    return context$2$0.abrupt('return', context$2$0.sent);

                case 24:
                case 'end':
                    return context$2$0.stop();
            }
        }, null, this);
    };

    QUnitServer.prototype._onTestDone = function _onTestDone(res, report, taskId) {
        var task = this.tasks[taskId];

        if (task.completed === task.total) return res.end();

        task.completed++;
        task.reports.push({
            name: _utilsPathToUrl2.default(_path2.default.join('/fixtures', _path2.default.relative(this.basePath, task.tests[0]))),
            result: report
        });

        task.tests.shift();

        var redirectUrl = null;

        if (task.tests.length) redirectUrl = _utilsPathToUrl2.default('/fixtures/' + _path2.default.relative(this.basePath, task.tests[0]) + '?taskId=' + taskId);else {
            redirectUrl = '/report/' + taskId;

            var failedTaskReports = task.reports.filter(function (report) {
                return report.result.failed;
            });
            var reports = task.reports;
            var taskPath = _utilsPathToUrl2.default(task.path).replace(/^\//, '');

            this.emit('taskDone', {
                id: taskId,
                taskPath: taskPath,
                encodedTaskPath: encodeURIComponent(taskPath),
                total: task.total,
                completed: task.completed,
                passed: task.completed - failedTaskReports.length,
                failed: failedTaskReports.length,
                reports: reports,
                failedTaskReports: failedTaskReports
            });
        }

        res.set('Content-Type', contentTypes['default']);
        res.end(redirectUrl);
    };

    QUnitServer.prototype._onReportRequest = function _onReportRequest(res, taskId) {
        var task = this.tasks[taskId];
        var failedTaskReports = task.reports.filter(function (report) {
            return report.result.failed;
        });
        var reports = task.reports;
        var taskPath = _utilsPathToUrl2.default(task.path).replace(/^\//, '');

        res.locals = {
            id: taskId,
            taskPath: taskPath,
            encodedTaskPath: encodeURIComponent(taskPath),
            total: task.total,
            completed: task.completed,
            passed: task.completed - failedTaskReports.length,
            failed: failedTaskReports.length,
            reports: reports,
            failedTaskReports: failedTaskReports
        };

        res.render('report');
    };

    //Test running

    QUnitServer.prototype._runDir = function _runDir(req, res, dir) {
        var relativeDir, testsPath, tests;
        return _regeneratorRuntime.async(function _runDir$(context$2$0) {
            while (1) switch (context$2$0.prev = context$2$0.next) {
                case 0:
                    relativeDir = _path2.default.relative('/fixtures', '/' + dir + '/');
                    testsPath = _path2.default.join(this.basePath, relativeDir);
                    context$2$0.next = 4;
                    return _regeneratorRuntime.awrap(_utilsGetTests2.default(testsPath, _path2.default.join(this.basePath)));

                case 4:
                    tests = context$2$0.sent;

                    if (tests.length) {
                        context$2$0.next = 7;
                        break;
                    }

                    return context$2$0.abrupt('return', res.redirect(302, this.basePath + dir));

                case 7:
                    context$2$0.next = 9;
                    return _regeneratorRuntime.awrap(this._runTests(req, res, tests, relativeDir));

                case 9:
                case 'end':
                    return context$2$0.stop();
            }
        }, null, this);
    };

    QUnitServer.prototype._runTests = function _runTests(req, res, tests, dir) {
        //console.log('runTests', tests, dir);

        var browserName, task;
        return _regeneratorRuntime.async(function _runTests$(context$2$0) {
            while (1) switch (context$2$0.prev = context$2$0.next) {
                case 0:
                    browserName = req.query.browserName || '';
                    task = {
                        id: ++this.tasksCounter,
                        path: _path2.default.join('/fixtures', dir || ''),
                        tests: tests,
                        total: tests.length,
                        completed: 0,
                        reports: []
                    };

                    console.log('browserName:', browserName);
                    console.dir(task);
                    this.tasks[task.id] = task;

                    this.emit('startedWorker', browserName, task.id.toString());

                    context$2$0.next = 6;
                    return _regeneratorRuntime.awrap(this._runTest(res, tests[0], task.id));

                case 6:
                case 'end':
                    return context$2$0.stop();
            }
        }, null, this);
    };

    QUnitServer.prototype._runTest = function _runTest(res, testPath, taskId) {
        console.log('runTest', testPath, taskId);
        var test, markup, markupFileName, hostname, crossDomainHostname, relativeTestPath, globals;
        return _regeneratorRuntime.async(function _runTest$(context$2$0) {
            while (1) switch (context$2$0.prev = context$2$0.next) {
                case 0:
                    context$2$0.next = 2;
                    return _regeneratorRuntime.awrap(fs.readfile(testPath, 'utf-8'));

                case 2:
                    test = context$2$0.sent;
                    markup = '';

                    if (!/-test$/.test(_path2.default.dirname(testPath))) {
                        context$2$0.next = 12;
                        break;
                    }

                    markupFileName = testPath.replace('-test.js', '.html');
                    context$2$0.next = 8;
                    return _regeneratorRuntime.awrap(fs.stat(markupFileName));

                case 8:
                    if (!context$2$0.sent) {
                        context$2$0.next = 12;
                        break;
                    }

                    context$2$0.next = 11;
                    return _regeneratorRuntime.awrap(fs.readfile(markupFileName, 'utf-8'));

                case 11:
                    markup = context$2$0.sent;

                case 12:
                    hostname = this.hostname;
                    crossDomainHostname = this.crossDomainHostname;
                    relativeTestPath = _path2.default.relative(this.basePath, testPath);
                    globals = _mustache2.default.render(this.globalsTemplate, {
                        crossDomainHostname: crossDomainHostname,
                        path: encodeURIComponent(_utilsPathToUrl2.default(relativeTestPath)),
                        testFullPath: encodeURIComponent(testPath.replace(/\\/g, '\\\\')),
                        taskId: taskId,
                        hostname: hostname
                    });

                    res.locals = {
                        markup: markup,
                        test: test,
                        taskId: taskId || '',
                        globals: globals,
                        qunitSetup: _mustache2.default.render(this.qunitSetupTemplate, { taskId: taskId }),
                        storeGlobals: _mustache2.default.render(this.storeGlobalsTemplate),
                        restoreGlobals: _mustache2.default.render(this.restoreGlobalsTemplate),
                        scripts: this.testResources.scripts,
                        css: this.testResources.css
                    };

                    res.render('test');

                case 18:
                case 'end':
                    return context$2$0.stop();
            }
        }, null, this);
    };

    //API

    QUnitServer.prototype.fixtures = function fixtures(basePath) {
        this.basePath = basePath;
        return this;
    };

    QUnitServer.prototype.port = function port(_port) {
        this.serverPort = _port;

        return this;
    };

    QUnitServer.prototype.crossDomainPort = function crossDomainPort(port) {
        this.crossDomainServerPort = port;

        return this;
    };

    QUnitServer.prototype.scripts = function scripts(_scripts) {
        var _this2 = this;

        if (Array.isArray(_scripts)) _scripts.forEach(function (script) {
            return _this2._registerScript(script);
        });else this._registerScript(_scripts);

        return this;
    };

    QUnitServer.prototype.css = function css(_css) {
        var _this3 = this;

        if (Array.isArray(_css)) _css.forEach(function (css) {
            return _this3._registerCss(css);
        });else this._registerCss(_css);

        return this;
    };

    QUnitServer.prototype.configApp = function configApp(config) {
        config(this.app);
        config(this.crossDomainApp);

        return this;
    };

    QUnitServer.prototype.before = function before(callback) {
        this.beforeCallback = callback;

        return this;
    };

    QUnitServer.prototype.after = function after(callback) {
        this.afterCallback = callback;

        return this;
    };

    QUnitServer.prototype.saucelabs = function saucelabs(settings) {
        var curSettings = this.sauselabsSettings || {};

        this.sauselabsSettings = {
            username: settings.username || curSettings.username || '',
            accessKey: settings.accessKey || curSettings.accessKey || '',
            build: settings.build || curSettings.build || 'build',
            tags: settings.tags || curSettings.tags || 'master',
            browsers: settings.browsers || curSettings.browsers || {},
            name: settings.name || curSettings.name || 'QUnit tests',
            urls: [this.hostname + '/start'],
            timeout: settings.timeout || curSettings.timeout || 30
        };

        return this;
    };

    QUnitServer.prototype.cli = function cli(settings) {
        var curSettings = this.cliSettings || {};

        this.cliSettings = {
            browsers: settings.browsers || curSettings.browsers || {},
            startUrl: [this.hostname + '/run-tests'],
            timeout: settings.timeout || curSettings.timeout || 30
        };

        return this;
    };

    QUnitServer.prototype.create = function create() {
        if (!this.basePath) throw 'fixtures path is not defined';

        this._createServers();
        this._setupRoutes();

        console.log('QUnit server listens on', this.hostname);

        if (typeof this.beforeCallback === 'function') this.beforeCallback();

        return this;
    };

    QUnitServer.prototype.tests = function tests(_tests) {
        this.pendingTests = _tests;
        return this;
    };

    QUnitServer.prototype.run = function run() {
        var report, error, tunnel, reportRes;
        return _regeneratorRuntime.async(function run$(context$2$0) {
            while (1) switch (context$2$0.prev = context$2$0.next) {
                case 0:
                    if (!(!this.sauselabsSettings && !this.cliSettings)) {
                        context$2$0.next = 2;
                        break;
                    }

                    return context$2$0.abrupt('return');

                case 2:
                    report = null;
                    error = null;

                    if (!this.sauselabsSettings) {
                        context$2$0.next = 20;
                        break;
                    }

                    context$2$0.next = 7;
                    return _regeneratorRuntime.awrap(saucelabs.openTunnel(this.sauselabsSettings));

                case 7:
                    tunnel = context$2$0.sent;
                    context$2$0.prev = 8;
                    context$2$0.next = 11;
                    return _regeneratorRuntime.awrap(saucelabs.run(this.sauselabsSettings));

                case 11:
                    report = context$2$0.sent;
                    context$2$0.next = 17;
                    break;

                case 14:
                    context$2$0.prev = 14;
                    context$2$0.t0 = context$2$0['catch'](8);

                    error = context$2$0.t0;

                case 17:

                    try {
                        saucelabs.closeTunnel(tunnel);
                    } catch (err) {
                        console.log('ERROR: Can not close saucelabs tunnel:', err);
                    }
                    context$2$0.next = 29;
                    break;

                case 20:
                    context$2$0.prev = 20;
                    context$2$0.next = 23;
                    return _regeneratorRuntime.awrap(cli.run(this.cliSettings, this));

                case 23:
                    report = context$2$0.sent;
                    context$2$0.next = 29;
                    break;

                case 26:
                    context$2$0.prev = 26;
                    context$2$0.t1 = context$2$0['catch'](20);

                    error = context$2$0.t1;

                case 29:
                    if (!error) {
                        context$2$0.next = 31;
                        break;
                    }

                    throw error;

                case 31:

                    try {
                        reportRes = null;

                        if (this.sauselabsSettings) reportRes = _saucelabsReport2.default(report);else reportRes = _cliReport2.default(report);
                    } catch (err) {
                        console.log('ERROR: Can not create the report:', err);
                    }

                    if (reportRes) {
                        context$2$0.next = 34;
                        break;
                    }

                    throw 'tests failed';

                case 34:
                case 'end':
                    return context$2$0.stop();
            }
        }, null, this, [[8, 14], [20, 26]]);
    };

    QUnitServer.prototype.close = function close() {
        var _this4 = this;

        if (typeof this.afterCallback === 'function') this.afterCallback();

        this.appServer.close();
        this.crossDomainAppServer.close();

        if (this.cliSettings) {
            _Object$keys(this.tasks).forEach(function (taskId) {
                var task = _this4.tasks[taskId];

                if (task.reports.some(function (report) {
                    return report.result.failed;
                })) process.exit(-1);
            });

            process.exit(0);
        }
    };

    return QUnitServer;
})(_events.EventEmitter);

exports.default = QUnitServer;
;
module.exports = exports.default;
