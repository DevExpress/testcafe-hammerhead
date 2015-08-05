var Promise = require('promise'),
    request = require('request');

var CHECK_RESULTS_TIMEOUT = 1000 * 2;

var QUnitTestRunner = module.exports = function (options) {
    var browsers = options.browsers || [];

    browsers = browsers.map(function (item) {
        return [item.platform || '', item.browserName || '', item.version || ''];
    });

    this.options = {
        username:         options.username || '',
        key:              options.key || '',
        build:            options.build || Date.now(),
        browsers:         browsers,
        testName:         options.testName || 'QUnit tests',
        tags:             options.tags || ['master'],
        urls:             options.urls || [],
        tunnelIdentifier: options.tunnelIdentifier || Math.floor((new Date()).getTime() / 1000 - 1230768000).toString()
    };
};

QUnitTestRunner.prototype._sendRequest = function (params) {
    var sendRequest = Promise.denodeify(request);

    return sendRequest(params)
        .then(function (result) {
            var statusCode = result.statusCode;
            var body       = result.body;

            if (statusCode !== 200) {
                throw [
                    'Unexpected response from the Sauce Labs API.',
                    params.method + ' ' + params.url,
                    'Response status: ' + statusCode,
                    'Body: ' + JSON.stringify(body)
                ].join('\n');
            }

            return body;
        },
        function (error) {
            throw 'Could not connect to Sauce Labs API: ' + error.toString();
        }
    );
};

QUnitTestRunner.prototype.runTests = function () {
    var runner = this;

    var runTaskPromises = this.options.urls.map(function (url) {
        return runner._startTask(runner.options.browsers, url)
            .then(function (taskIds) {
                var completeTaskPromises = taskIds.map(function (id) {
                    return runner._completeTask(id);
                });

                return Promise.all(completeTaskPromises);
            })
            .then(function (result) {
                return result;
            });
    });

    return Promise.all(runTaskPromises)
        .then(function (results) {
            return results;
        })
        .catch(function (err) {
            throw 'RUN TESTS ERROR: ' + err;
        });
};

QUnitTestRunner.prototype._startTask = function (browsers, url) {
    var params = {
        method: 'POST',
        url:    ['https://saucelabs.com/rest/v1', this.options.username, 'js-tests'].join('/'),
        auth:   { user: this.options.username, pass: this.options.key },
        json:   {
            platforms:           browsers,
            url:                 url,
            framework:           'qunit',
            passed:              true,
            public:              'public',
            build:               this.options.build,
            tags:                this.options.tags,
            name:                this.options.testName,
            'tunnel-identifier': this.options.tunnelIdentifier
        }
    };

    return this._sendRequest(params)
        .then(function (body) {
            var taskIds = body['js tests'];

            if (!taskIds || !taskIds.length)
                throw 'Error starting tests through Sauce API: ' + JSON.stringify(body);

            return taskIds;
        });
};

QUnitTestRunner.prototype._completeTask = function (taskId) {
    return this._waitForTaskCompleted(taskId)
        .then(function (result) {
            return result;
        });
};

QUnitTestRunner.prototype._waitForTaskCompleted = function (taskId) {
    var runner = this;
    var params = {
        method: 'POST',
        url:    ['https://saucelabs.com/rest/v1', runner.options.username, 'js-tests/status'].join('/'),
        auth:   { user: runner.options.username, pass: runner.options.key },
        json:   { 'js tests': [taskId] }
    };

    return new Promise(function (resolve, reject) {
        function checkResult () {
            runner._sendRequest(params)
                .then(function (body) {
                    var result = body['js tests'] && body['js tests'][0];

                    if (!body.completed) {
                        return wait(CHECK_RESULTS_TIMEOUT)
                            .then(checkResult);
                    }

                    resolve(result);
                })
                .catch(function (err) {
                    reject(err);
                })
        }

        checkResult();
    });
};

function wait (ms) {
    return new Promise(function (resolve) {
        setTimeout(resolve, ms);
    });
}
