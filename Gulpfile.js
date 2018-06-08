const babel          = require('babel-core');
const gulpBabel      = require('gulp-babel');
const del            = require('del');
const eslint         = require('gulp-eslint');
const fs             = require('fs');
const gulp           = require('gulp');
const gulpStep       = require('gulp-step');
const qunitHarness   = require('gulp-qunit-harness');
const mocha          = require('gulp-mocha');
const mustache       = require('gulp-mustache');
const rename         = require('gulp-rename');
const webmake        = require('gulp-webmake');
const uglify         = require('gulp-uglify');
const gulpif         = require('gulp-if');
const util           = require('gulp-util');
const ll             = require('gulp-ll-next');
const gulpRunCommand = require('gulp-run-command').default;
const path           = require('path');

const selfSignedCertificate = require('openssl-self-signed-certificate');

gulpStep.install();

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
        platform:    'OS X 10.12',
        version:     '11.0'
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
        version:     '6.0',
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
    timeout:   360
};

function hang () {
    return new Promise(() => {
        // NOTE: Hang forever.
    });
}

// Build
gulp.task('clean', () => {
    return del(['./lib']);
});

gulp.step('client-scripts-bundle', () => {
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

gulp.step('client-scripts-render', () => {
    return gulp.src('./src/client/index.js.wrapper.mustache')
        .pipe(mustache({ source: fs.readFileSync('./lib/client/hammerhead.js').toString() }))
        .pipe(rename('hammerhead.js'))
        .pipe(gulpif(!util.env.dev, uglify()))
        .pipe(gulp.dest('./lib/client'));
});

gulp.step('client-scripts', gulp.series('client-scripts-bundle', 'client-scripts-render'));

gulp.step('server-scripts', () => {
    return gulp.src(['./src/**/*.js', '!./src/client/**/*.js'])
        .pipe(gulpBabel())
        .pipe(gulp.dest('lib/'));
});

gulp.step('templates', () => {
    return gulp
        .src('./src/client/task.js.mustache', { silent: false })
        .pipe(gulp.dest('./lib/client'));
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

gulp.task('build',
    gulp.series(
        'clean',
        gulp.parallel(
            'client-scripts',
            'server-scripts',
            'templates',
            'lint'
        )
    )
);

// Test
gulp.step('test-server-run', () => {
    return gulp.src('./test/server/*-test.js', { read: false })
        .pipe(mocha({
            // NOTE: Disable timeouts in debug mode.
            timeout:   typeof v8debug !== 'undefined' || !!process.debugPort ? Infinity : 2000,
            fullTrace: true
        }));
});

gulp.task('test-server', gulp.series('build', 'test-server-run'));

gulp.step('test-client-run', () => {
    gulp.watch('./src/**', gulp.series('build'));

    return gulp
        .src('./test/client/fixtures/**/*-test.js')
        .pipe(qunitHarness(CLIENT_TESTS_SETTINGS));
});

gulp.task('test-client', gulp.series('build', 'test-client-run'));

gulp.step('set-dev-mode', done => {
    util.env.dev = true;
    done();
});

gulp.task('test-client-dev', gulp.series('set-dev-mode', 'test-client'));

gulp.step('test-client-travis-run', () => {
    return gulp
        .src('./test/client/fixtures/**/*-test.js')
        .pipe(qunitHarness(CLIENT_TESTS_SETTINGS, SAUCELABS_SETTINGS));
});

gulp.task('test-client-travis', gulp.series('build', 'test-client-travis-run'));

gulp.step('http-playground-run', () => {
    require('./test/playground/server.js').start();

    return hang();
});

gulp.task('http-playground', gulp.series('set-dev-mode', 'build', 'http-playground-run'));

gulp.step('https-playground-run', () => {
    require('./test/playground/server.js').start({
        key:  selfSignedCertificate.key,
        cert: selfSignedCertificate.cert
    });

    return hang();
});

gulp.task('https-playground', gulp.series('set-dev-mode', 'build', 'https-playground-run'));

gulp.task('test-functional-testcafe-travis',
    gulp.series('build',
        gulpRunCommand([
            'chmod +x ./test/functional/run-testcafe-functional-tests.sh',
            './test/functional/run-testcafe-functional-tests.sh'
        ])
    )
);

gulp.task('travis', process.env.GULP_TASK ? gulp.series(process.env.GULP_TASK) : () => {});
