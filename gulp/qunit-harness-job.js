'use strict';

var _createClass = require('babel-runtime/helpers/create-class').default;

var _classCallCheck = require('babel-runtime/helpers/class-call-check').default;

var _regeneratorRuntime = require('babel-runtime/regenerator').default;

var _Object$keys = require('babel-runtime/core-js/object/keys').default;

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default').default;

exports.__esModule = true;

var _wd = require('wd');

var _wd2 = _interopRequireDefault(_wd);

var _promisifyEvent = require('promisify-event');

var _promisifyEvent2 = _interopRequireDefault(_promisifyEvent);

var _lodash = require('lodash');

var _request = require('./request');

var _request2 = _interopRequireDefault(_request);

var _utilsWait = require('../utils/wait');

var _utilsWait2 = _interopRequireDefault(_utilsWait);

var CHECK_TEST_RESULT_DELAY = 10 * 1000;
var MAX_JOB_RESTART_COUNT = 3;
var BROWSER_INIT_RETRY_DELAY = 30 * 1000;
var BROWSER_INIT_RETRIES = 3;
var BROWSER_INIT_TIMEOUT = 9 * 60 * 1000;

_wd2.default.configureHttp({
    retryDelay: BROWSER_INIT_RETRY_DELAY,
    retries: BROWSER_INIT_RETRIES,
    timeout: BROWSER_INIT_TIMEOUT
});

//Job

var Job = (function () {
    function Job(options, browserInfo) {
        _classCallCheck(this, Job);

        this.options = {
            username: options.username,
            accessKey: options.accessKey,
            build: options.build,
            testName: options.testName,
            tags: options.tags,
            urls: options.urls,
            tunnelIdentifier: options.tunnelIdentifier,
            testsTimeout: options.timeout * 1000
        };

        this.requestAdapter = new _request2.default(this.options.username, this.options.accessKey);
        this.browserInfo = browserInfo;
        this.browser = _wd2.default.promiseRemote('ondemand.saucelabs.com', 80, options.username, options.accessKey);

        this.status = Job.STATUSES.INITIALIZED;
        this.restartCount = 0;
        this.startTestsTime = null;

        var platformName = browserInfo.platform || browserInfo.platformName || '';
        var browserName = browserInfo.browserName || '';
        var plaformVersion = browserInfo.version || browserInfo.platformVersion || '';

        this.platform = [platformName, browserName, plaformVersion];
    }

    Job.prototype._getTestResult = function _getTestResult() {
        var testResult, windowErrorMessage, ie11ErrorMessage;
        return _regeneratorRuntime.async(function _getTestResult$(context$2$0) {
            while (1) switch (context$2$0.prev = context$2$0.next) {
                case 0:
                    testResult = null;

                case 1:
                    if (testResult) {
                        context$2$0.next = 20;
                        break;
                    }

                    if (!(new Date() - this.startTestsTime > this.options.testsTimeout)) {
                        context$2$0.next = 4;
                        break;
                    }

                    throw new Error('Test exceeded maximum duration');

                case 4:
                    context$2$0.next = 6;
                    return _regeneratorRuntime.awrap(_utilsWait2.default(CHECK_TEST_RESULT_DELAY));

                case 6:
                    context$2$0.prev = 6;
                    context$2$0.next = 9;
                    return _regeneratorRuntime.awrap(this.browser.eval('window.global_test_results'));

                case 9:
                    testResult = context$2$0.sent;
                    context$2$0.next = 18;
                    break;

                case 12:
                    context$2$0.prev = 12;
                    context$2$0.t0 = context$2$0['catch'](6);
                    windowErrorMessage = 'window has no properties';
                    ie11ErrorMessage = ['Error response status: 13, , ', 'UnknownError - An unknown server-side error occurred while processing the command. ', 'Selenium error: JavaScript error (WARNING: The server did not provide any stacktrace information)'].join('');

                    if (!(context$2$0.t0.message.indexOf(windowErrorMessage) < 0 && context$2$0.t0.message.indexOf(ie11ErrorMessage) < 0)) {
                        context$2$0.next = 18;
                        break;
                    }

                    throw context$2$0.t0;

                case 18:
                    context$2$0.next = 1;
                    break;

                case 20:
                    return context$2$0.abrupt('return', testResult);

                case 21:
                case 'end':
                    return context$2$0.stop();
            }
        }, null, this, [[6, 12]]);
    };

    Job.prototype._getJobResult = function _getJobResult() {
        var testResult;
        return _regeneratorRuntime.async(function _getJobResult$(context$2$0) {
            while (1) switch (context$2$0.prev = context$2$0.next) {
                case 0:
                    this.status = Job.STATUSES.IN_PROGRESS;

                    this.startTestsTime = new Date();

                    context$2$0.next = 4;
                    return _regeneratorRuntime.awrap(this._getTestResult());

                case 4:
                    testResult = context$2$0.sent;

                    this.status = Job.STATUSES.COMPLETED;

                    context$2$0.prev = 6;
                    context$2$0.next = 9;
                    return _regeneratorRuntime.awrap(this._publishTestResult(testResult));

                case 9:
                    context$2$0.next = 14;
                    break;

                case 11:
                    context$2$0.prev = 11;
                    context$2$0.t0 = context$2$0['catch'](6);

                    this._reportError('An error occurred while the test result was being published: ' + context$2$0.t0);

                case 14:
                    return context$2$0.abrupt('return', {
                        url: 'https://saucelabs.com/jobs/' + this.browser.sessionID,
                        platform: this.platform,
                        result: testResult,
                        job_id: this.browser.sessionID
                    });

                case 15:
                case 'end':
                    return context$2$0.stop();
            }
        }, null, this, [[6, 11]]);
    };

    Job.prototype._reportError = function _reportError(error) {
        console.log('The task (' + this.platform + ') failed: ' + error);
    };

    Job.prototype._publishTestResult = function _publishTestResult(testResult) {
        var testSuccess, data;
        return _regeneratorRuntime.async(function _publishTestResult$(context$2$0) {
            while (1) switch (context$2$0.prev = context$2$0.next) {
                case 0:
                    testSuccess = (testResult.errors.length === 0 || _Object$keys(testResult.errors).length === 0) && testResult.failed === 0;
                    data = {
                        public: 'public',
                        passed: testSuccess,
                        'custom-data': {
                            'qunit': testResult
                        }
                    };
                    context$2$0.next = 4;
                    return _regeneratorRuntime.awrap(this.requestAdapter.put('/v1/' + this.options.username + '/jobs/' + this.browser.sessionID, data));

                case 4:
                case 'end':
                    return context$2$0.stop();
            }
        }, null, this);
    };

    Job.prototype.run = function run() {
        var jobResult, jobFailed, initBrowserParams, initBrowserPromise;
        return _regeneratorRuntime.async(function run$(context$2$0) {
            while (1) switch (context$2$0.prev = context$2$0.next) {
                case 0:
                    jobResult = null;
                    jobFailed = false;
                    initBrowserParams = {
                        name: this.options.testName,
                        tags: this.options.tags,
                        build: this.options.build,
                        tunnelIdentifier: this.options.tunnelIdentifier
                    };

                    _lodash.assign(initBrowserParams, this.browserInfo);

                    this.status = Job.STATUSES.INIT_BROWSER;

                    context$2$0.prev = 5;
                    initBrowserPromise = _promisifyEvent2.default(this.browser, 'status');

                    this.browser.init(initBrowserParams);
                    console.dir(initBrowserParams);

                    context$2$0.next = 10;
                    return _regeneratorRuntime.awrap(initBrowserPromise);

                case 10:
                    context$2$0.next = 12;

                    console.log('this.browser.get(this.options.urls[0])', this.options.urls);
                    return _regeneratorRuntime.awrap(this.browser.get(this.options.urls[0]));

                case 12:
                    context$2$0.next = 18;
                    break;

                case 14:
                    context$2$0.prev = 14;
                    context$2$0.t0 = context$2$0['catch'](5);

                    this._reportError('An error occured while the browser was being initialized: ' + context$2$0.t0);
                    jobFailed = true;

                case 18:
                    if (jobFailed) {
                        context$2$0.next = 37;
                        break;
                    }

                    context$2$0.prev = 19;
                    context$2$0.next = 22;
                    return _regeneratorRuntime.awrap(this._getJobResult());

                case 22:
                    jobResult = context$2$0.sent;
                    context$2$0.next = 29;
                    break;

                case 25:
                    context$2$0.prev = 25;
                    context$2$0.t1 = context$2$0['catch'](19);

                    this._reportError(context$2$0.t1);
                    jobFailed = true;

                case 29:
                    context$2$0.prev = 29;
                    context$2$0.next = 32;
                    return _regeneratorRuntime.awrap(this.browser.quit());

                case 32:
                    context$2$0.next = 37;
                    break;

                case 34:
                    context$2$0.prev = 34;
                    context$2$0.t2 = context$2$0['catch'](29);

                    this._reportError('An error occured while the browser was being closed: ' + context$2$0.t2);

                case 37:
                    if (!jobFailed) {
                        context$2$0.next = 48;
                        break;
                    }

                    if (!(++this.restartCount < MAX_JOB_RESTART_COUNT)) {
                        context$2$0.next = 45;
                        break;
                    }

                    console.log('Attempt ' + this.restartCount + ' to restart the task (' + this.platform + ')');

                    context$2$0.next = 42;
                    return _regeneratorRuntime.awrap(this.run());

                case 42:
                    jobResult = context$2$0.sent;
                    context$2$0.next = 48;
                    break;

                case 45:
                    jobResult = {
                        platform: this.platform,
                        job_id: this.browser.sessionID
                    };

                    if (this.status === Job.STATUSES.IN_PROGRESS) jobResult.url = 'https://saucelabs.com/jobs/' + this.browser.sessionID;

                    this.status = Job.STATUSES.FAILED;

                case 48:
                    return context$2$0.abrupt('return', jobResult);

                case 49:
                case 'end':
                    return context$2$0.stop();
            }
        }, null, this, [[5, 14], [19, 25], [29, 34]]);
    };

    Job.prototype.getStatus = function getStatus() {
        return this.status;
    };

    _createClass(Job, null, [{
        key: 'STATUSES',
        value: {
            INIT_BROWSER: 'init browser',
            INITIALIZED: 'initialized',
            IN_PROGRESS: 'in progress',
            COMPLETED: 'completed',
            FAILED: 'failed'
        },
        enumerable: true
    }]);

    return Job;
})();

exports.default = Job;
module.exports = exports.default;

// NOTE: this error may occur while testing against internet explorer 11.
// This may happen because the IE driver sometimes throws an unknown error
// when executing an expression with the 'window' object.
