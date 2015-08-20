/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//Useful tasks:
//
//      $ gulp server-tests                        - run mocha tests
//      $ gulp client-tests                        - run qunit test page
//      $ gulp playground                          - run playground page
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

var babel        = require('babel');
var gulpBabel    = require('gulp-babel');
var del          = require('del');
var eslint       = require('gulp-eslint');
var fs           = require('fs');
var gulp         = require('gulp');
var qunitHarness = require('gulp-qunit-harness');
var mocha        = require('gulp-mocha');
var mustache     = require('gulp-mustache');
var rename       = require('gulp-rename');
var sourcemaps   = require('gulp-sourcemaps');
var webmake      = require('gulp-webmake');
var Promise      = require('es6-promise').Promise;
var runSequence  = require('run-sequence');


var CLIENT_TESTS_SETTINGS = {
    basePath:        './test/client/fixtures',
    port:            2000,
    crossDomainPort: 2001,
    scripts:         [
        { src: '/hammerhead.js', path: './lib/client/hammerhead.js' },
        { src: '/before-test.js', path: './test/client/before-test.js' }
    ],

    configApp: require('./test/client/config-qunit-server-app')
};

var CLIENT_TESTS_BROWSERS = [
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
        browserName: 'safari',
        platform:    'OS X 10.10',
        version:     '8.0'
    },
    {
        browserName: 'iphone',
        platform:    'OS X 10.10',
        version:     '8.1',
        deviceName:  'iPad Simulator'
    },
    {
        browserName: 'android',
        platform:    'Linux',
        version:     '5.1',
        deviceName:  'Android Emulator'
    }
];

var SAUCELABS_SETTINGS = {
    username:  process.env.SAUCE_USERNAME,
    accessKey: process.env.SAUCE_ACCESS_KEY,
    build:     process.env.TRAVIS_JOB_ID || '',
    tags:      [process.env.TRAVIS_BRANCH || 'master'],
    browsers:  CLIENT_TESTS_BROWSERS,
    name:      'testcafe-hammerhead client tests',
    timeout:   300
};

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
                //https://github.com/jakearchibald/es6-promise/issues/108
                if (filename.indexOf('es6-promise.js') !== -1) {
                    var polyfillCallString = 'lib$es6$promise$polyfill$$default();';

                    code = code.replace(polyfillCallString, '');
                }
                ///////////////////////////////////////////////////////////////

                var transformed = babel.transform(code, { sourceMap: false, filename: filename, blacklist: ['runtime'] });

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
    gulp.watch('./src/**', ['rebuild']);

    return gulp
        .src('./test/client/fixtures/**/*-test.js')
        .pipe(qunitHarness(CLIENT_TESTS_SETTINGS));
});

gulp.task('client-tests-travis', ['rebuild'], function () {
    return gulp
        .src('./test/client/fixtures/**/*-test.js')
        .pipe(qunitHarness(CLIENT_TESTS_SETTINGS, SAUCELABS_SETTINGS));
});

gulp.task('playground', ['rebuild'], function () {
    require('./test/playground/server.js').start();

    return hang();
});

gulp.task('travis', [process.env.GULP_TASK || '']);
