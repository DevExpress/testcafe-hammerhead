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
var webmake      = require('gulp-webmake');
var Promise      = require('pinkie');
var uglify       = require('gulp-uglify');
var gulpif       = require('gulp-if');
var util         = require('gulp-util');

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
        browserName: 'microsoftedge',
        version:     '20.10240'
    },
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
        browserName: 'iphone',
        platform:    'OS X 10.10',
        version:     '9.0',
        deviceName:  'iPhone 6 Plus'
    },
    {
        browserName: 'android',
        platform:    'Linux',
        version:     '5.1',
        deviceName:  'Android Emulator'
    },
    {
        browserName: 'chrome',
        platform:    'OS X 10.11'
    },
    {
        browserName: 'firefox',
        platform:    'OS X 10.11'
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
        // NOTE: Hang forever.
    });
}

gulp.task('clean', function (cb) {
    del(['./lib'], cb);
});

gulp.task('templates', ['clean'], function () {
    return gulp
        .src('./src/client/task.js.mustache', { silent: false })
        .pipe(gulp.dest('./lib/client'));
});

gulp.task('client-scripts', ['client-scripts-bundle'], function () {
    return gulp.src('./src/client/index.js.wrapper.mustache')
        .pipe(mustache({
            source:    fs.readFileSync('./lib/client/hammerhead.js').toString(),
            sourceMap: ''
        }))
        .pipe(rename('hammerhead.js'))
        .pipe(gulpif(util.env.release, uglify()))
        .pipe(gulp.dest('./lib/client'));
});

gulp.task('client-scripts-bundle', ['clean'], function () {
    return gulp.src('./src/client/index.js')
        .pipe(webmake({
            sourceMap: false,
            transform: function (filename, code) {
                var transformed = babel.transform(code, {
                    sourceMap: false,
                    filename:  filename,
                    blacklist: ['runtime']
                });

                return {
                    code:      transformed.code,
                    sourceMap: transformed.map
                };
            }
        }))
        .pipe(rename('hammerhead.js'))
        .pipe(gulp.dest('./lib/client'));
});

gulp.task('server-scripts', ['clean'], function () {
    return gulp.src(['./src/**/*.js', '!./src/client/**/*.js'])
        .pipe(gulpBabel())
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

gulp.task('test-server', ['build'], function () {
    return gulp.src('./test/server/*-test.js', { read: false })
        .pipe(mocha({
            ui:       'bdd',
            reporter: 'spec',
            // NOTE: Disable timeouts in debug mode.
            timeout:  typeof v8debug === 'undefined' ? 2000 : Infinity
        }));
});

gulp.task('test-client', ['build'], function () {
    gulp.watch('./src/**', ['build']);

    return gulp
        .src('./test/client/fixtures/**/*-test.js')
        .pipe(qunitHarness(CLIENT_TESTS_SETTINGS));
});

gulp.task('test-client-travis', ['build'], function () {
    return gulp
        .src('./test/client/fixtures/**/*-test.js')
        .pipe(qunitHarness(CLIENT_TESTS_SETTINGS, SAUCELABS_SETTINGS));
});

gulp.task('playground', ['build'], function () {
    require('./test/playground/server.js').start();

    return hang();
});

gulp.task('travis', [process.env.GULP_TASK || '']);
