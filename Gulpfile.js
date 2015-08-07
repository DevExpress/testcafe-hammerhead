/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//Useful tasks:
//
//      $ gulp server-tests                        - run mocha tests
//      $ gulp client-tests                        - run qunit test page
//      $ gulp playground                          - run playground page
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

var babel       = require('babel');
var gulpBabel   = require('gulp-babel');
var del         = require('del');
var eslint      = require('gulp-eslint');
var fs          = require('fs');
var gulp        = require('gulp');
var mocha       = require('gulp-mocha');
var mustache    = require('gulp-mustache');
var rename      = require('gulp-rename');
var sourcemaps  = require('gulp-sourcemaps');
var webmake     = require('gulp-webmake');
var chalk       = require('chalk');
var Promise     = require('promise');
var runSequence = require('run-sequence');

function hang () {
    return new Promise(function () {
        // NOTE: hang forever
    });
}

gulp.task('clean', function () {
    return new Promise(function (resolve) {
        del(['./lib'], resolve);
    });
});

gulp.task('templates', function () {
    return gulp
        .src('./src/client/templates/task.js.mustache', { silent: false })
        .pipe(gulp.dest('./lib/client'));
});

gulp.task('client-scripts', ['client-scripts-bundle'], function () {
    return gulp.src('./src/client/templates/hammerhead.js.mustache')
        .pipe(mustache({
            source:    fs.readFileSync('./lib/client/hammerhead.js').toString(),
            sourceMap: ''
        }))
        .pipe(rename('hammerhead.js'))
        .pipe(gulp.dest('./lib/client'));
});

gulp.task('client-scripts-bundle', function () {
    return gulp.src('./src/client/hammerhead.js')
        .pipe(webmake({
            sourceMap: false,
            transform: function (filename, code) {
                var transformed = babel.transform(code, { sourceMap: false, blacklist: ['strict'] });

                return {
                    code:      transformed.code,
                    sourceMap: transformed.map
                };
            }
        }))
        .pipe(gulp.dest('./lib/client'));
});

gulp.task('server-scripts', function () {
    return gulp.src(['./src/**/*.js', '!./src/client/**/*.js'])
        .pipe(sourcemaps.init())
        .pipe(gulpBabel())
        .pipe(sourcemaps.write('.', {
            includeContent: true,
            sourceRoot:     '../src'
        }))
        .pipe(gulp.dest('lib/'));
});

gulp.task('lint', function () {
    return gulp
        .src([
            './src/**/*.js',
            './test/server/*.js',
            './test/client/fixtures/**/*.js',
            'Gulpfile.js'
        ])
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(eslint.failAfterError());
});

gulp.task('build', ['client-scripts', 'server-scripts', 'templates', 'lint']);

gulp.task('rebuild', function (callback) {
    runSequence('clean', 'build', callback);
});

gulp.task('server-tests', ['rebuild'], function () {
    return gulp.src('./test/server/*-test.js', { read: false })
        .pipe(mocha({
            ui:       'bdd',
            reporter: 'spec',
            // NOTE: disable timeouts in debug
            timeout:  typeof v8debug === 'undefined' ? 2000 : Infinity
        }));
});

gulp.task('client-tests', ['rebuild'], function () {
    gulp.watch(['./src/**', './test/client/fixtures/**'], ['rebuild']);

    require('./test/client/server.js').start();

    return hang();
});

gulp.task('playground', ['rebuild'], function () {
    require('./test/playground/server.js').start();

    return hang();
});

gulp.task('travis', [process.env.GULP_TASK || '']);

(function SAUCE_LABS_QUNIT_TESTING () {
    var SauceTunnel = require('sauce-tunnel');
    var QUnitRunner = require('./test/client/sauce-labs-runner');
    var qunitServer = require('./test/client/server.js');

    var SAUCE_USERNAME   = process.env.SAUCE_USERNAME || '';
    var SAUCE_ACCESS_KEY = process.env.SAUCE_ACCESS_KEY || '';

    var RUN_TESTS_URL = '/run-dir?dir=fixtures';
    var BROWSERS      = [
        {
            platform:    'Windows 10',
            browserName: 'chrome'
        },
        {
            platform:    'Windows 10',
            browserName: 'firefox'
        },
        {
            platform:    'Windows 10',
            browserName: 'internet explorer',
            version:     '11.0'
        },
        {
            platform:    'Windows 8',
            browserName: 'internet explorer',
            version:     '10.0'
        },
        {
            platform:    'Windows 7',
            browserName: 'internet explorer',
            version:     '9.0'
        },
        {
            browserName: 'iphone',
            platform:    'OS X 10.10',
            version:     '7.1',
            deviceName:  'iPhone Simulator'
        },
        {
            browserName: 'android',
            platform:    'Linux',
            version:     '5.1',
            deviceName:  'Android Emulator'
        }
    ];

    function openSauceTunnel (username, password, id, tunneled) {
        return new Promise(function (resolve, reject) {
            var tunnel = new SauceTunnel(username, password, id, tunneled);

            tunnel.start(function (isCreated) {
                if (!isCreated)
                    reject('Failed to create Sauce tunnel');
                else
                    resolve(tunnel);
            });
        });
    }

    function stopSauceTunnel (tunnel) {
        return new Promise(function (resolve, reject) {
            if (!tunnel)
                reject();
            else
                tunnel.stop(resolve);
        });
    }

    function checkFailures (results) {
        var errors = [];

        results[0].forEach(function (platformResults) {
            var msg      = [];
            var platform = [platformResults.platform[0], platformResults.platform[1], platformResults.platform[2] ||
                                                                                      ''].join(' ');

            msg.push(chalk.bold(platformResults.result.failed ? chalk.red('FAILURES:') : chalk.green('OK:')));
            msg.push(platform);
            msg.push(chalk.bold('Total:'), platformResults.result.total);
            msg.push(chalk.bold('Failed:'), platformResults.result.failed);

            console.log(msg.join(' '));

            if (platformResults.result.errors) {
                platformResults.result.errors.forEach(function (error) {
                    error.platform = platform;
                    errors.push(error);
                });
            }
        });

        return errors;
    }

    function reportFailures (errors) {
        console.log(chalk.bold.red('ERRORS:'));

        errors.forEach(function (error) {
            console.log(chalk.bold(error.platform + ' - ' + error.testPath));
            console.log(chalk.bold('Test: ' + error.testName));

            if (error.customMessage)
                console.log('message: ' + error.customMessage);

            if (error.expected) {
                console.log('expected: ' + error.expected);
                console.log('actual: ' + error.actual);
            }

            console.log('-------------------------------------------');
            console.log();
        });
    }

    gulp.task('client-tests-travis', ['rebuild'], function (done) {
        var qunitAppUrl   = qunitServer.start(true);
        var sauceTunnelId = Math.floor((new Date()).getTime() / 1000 - 1230768000).toString();
        var sauceTunnel   = null;

        openSauceTunnel(SAUCE_USERNAME, SAUCE_ACCESS_KEY, sauceTunnelId, true)
            .then(function (tunnel) {
                sauceTunnel = tunnel;

                var runner = new QUnitRunner({
                    username:         SAUCE_USERNAME,
                    key:              SAUCE_ACCESS_KEY,
                    build:            process.env.TRAVIS_JOB_ID || '',
                    browsers:         BROWSERS,
                    tunnelIdentifier: sauceTunnelId,
                    urls:             [qunitAppUrl + RUN_TESTS_URL],
                    tags:             [process.env.TRAVIS_BRANCH || 'master']
                });

                return runner.runTests();
            })
            .then(function (results) {
                var errors = checkFailures(results);

                if (errors.length) {
                    reportFailures(errors);
                    throw 'tests failed';
                }
            })
            .then(function () {
                return stopSauceTunnel();
            })
            .then(done)
            .catch(function (err) {
                stopSauceTunnel(sauceTunnel)
                    .then(function () {
                        throw err;
                    })
                    .catch(function () {
                        qunitServer.stop();
                        done(err);
                    });
            });
    });
})();
