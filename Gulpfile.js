const babel        = require('babel-core');
const gulpBabel    = require('gulp-babel');
const del          = require('del');
const eslint       = require('gulp-eslint');
const fs           = require('fs');
const gulp         = require('gulp');
const qunitHarness = require('gulp-qunit-harness');
const mocha        = require('gulp-mocha');
const mustache     = require('gulp-mustache');
const rename       = require('gulp-rename');
const webmake      = require('gulp-webmake');
const Promise      = require('pinkie');
const uglify       = require('gulp-uglify');
const gulpif       = require('gulp-if');
const util         = require('gulp-util');
const ll           = require('gulp-ll');
const path         = require('path');

ll
    .tasks('lint')
    .onlyInDebug([
        'server-scripts',
        'client-scripts-bundle'
    ]);

const CLIENT_TESTS_SETTINGS = {
    basePath:        './test/client/fixtures',
    port:            2000,
    crossDomainPort: 2001,
    scripts:         [
        { src: '/hammerhead.js', path: './lib/client/hammerhead.js' },
        { src: '/before-test.js', path: './test/client/before-test.js' }
    ],

    configApp: require('./test/client/config-qunit-server-app')
};

const CLIENT_TESTS_BROWSERS = [
    {
        platform:    'Windows 10',
        browserName: 'MicrosoftEdge'
    },
    {
        platform:    'Windows 10',
        browserName: 'chrome'
    },
    // NOTE: version: 'beta' don't work anymore
    // {
    //     platform:    'Windows 10',
    //     browserName: 'chrome',
    //     version:     'beta'
    // },
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
        browserName: 'safari',
        platform:    'OS X 10.11',
        version:     '9.0'
    },
    {
        browserName:     'Safari',
        deviceName:      'iPhone 7 Plus Simulator',
        platformVersion: '10.3',
        platformName:    'iOS'
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

const SAUCELABS_SETTINGS = {
    username:  process.env.SAUCE_USERNAME,
    accessKey: process.env.SAUCE_ACCESS_KEY,
    build:     process.env.TRAVIS_JOB_ID || '',
    tags:      [process.env.TRAVIS_BRANCH || 'master'],
    browsers:  CLIENT_TESTS_BROWSERS,
    name:      'testcafe-hammerhead client tests',
    timeout:   300
};

function hang () {
    return new Promise(() => {
        // NOTE: Hang forever.
    });
}

// Build
gulp.task('clean', cb => {
    del(['./lib'], cb);
});

gulp.task('templates', ['clean'], () => {
    return gulp
        .src('./src/client/task.js.mustache', { silent: false })
        .pipe(gulp.dest('./lib/client'));
});

gulp.task('client-scripts', ['client-scripts-bundle'], () => {
    return gulp.src('./src/client/index.js.wrapper.mustache')
        .pipe(mustache({ source: fs.readFileSync('./lib/client/hammerhead.js').toString() }))
        .pipe(rename('hammerhead.js'))
        .pipe(gulpif(!util.env.dev, uglify()))
        .pipe(gulp.dest('./lib/client'));
});

gulp.task('client-scripts-bundle', ['clean'], () => {
    return gulp.src('./src/client/index.js')
        .pipe(webmake({
            sourceMap: false,
            transform: (filename, code) => {
                const transformed = babel.transform(code, {
                    sourceMap: false,
                    filename:  filename,
                    ast:       false,
                    // NOTE: force usage of client .babelrc for all
                    // files, regardless of their location
                    babelrc:   false,
                    extends:   path.join(__dirname, './src/client/.babelrc')
                });

                // HACK: babel-plugin-transform-es2015-modules-commonjs forces
                // 'use strict' insertion. We need to remove it manually because
                // of https://github.com/DevExpress/testcafe/issues/258
                return { code: transformed.code.replace(/^('|")use strict('|");?/, '') };
            }
        }))
        .pipe(rename('hammerhead.js'))
        .pipe(gulp.dest('./lib/client'));
});

gulp.task('server-scripts', ['clean'], () => {
    return gulp.src(['./src/**/*.js', '!./src/client/**/*.js'])
        .pipe(gulpBabel())
        .pipe(gulp.dest('lib/'));
});

gulp.task('lint', () => {
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


// Test
gulp.task('test-server', ['build'], () => {
    return gulp.src('./test/server/*-test.js', { read: false })
        .pipe(mocha({
            ui:        'bdd',
            reporter:  'spec',
            // NOTE: Disable timeouts in debug mode.
            timeout:   typeof v8debug === 'undefined' ? 2000 : Infinity,
            fullTrace: true
        }));
});

gulp.task('test-client', ['build'], () => {
    gulp.watch('./src/**', ['build']);

    return gulp
        .src('./test/client/fixtures/**/*-test.js')
        .pipe(qunitHarness(CLIENT_TESTS_SETTINGS));
});

gulp.task('test-client-travis', ['build'], () => {
    return gulp
        .src('./test/client/fixtures/**/*-test.js')
        .pipe(qunitHarness(CLIENT_TESTS_SETTINGS, SAUCELABS_SETTINGS));
});

gulp.task('playground', ['set-dev-mode', 'build'], () => {
    require('./test/playground/server.js').start();

    return hang();
});

gulp.task('travis', [process.env.GULP_TASK || '']);

gulp.task('set-dev-mode', function () {
    util.env.dev = true;
});
