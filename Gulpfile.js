const babel          = require('babel-core');
const gulpBabel      = require('gulp-babel');
const gulpTypeScript = require('gulp-typescript');
const del            = require('del');
const eslint         = require('gulp-eslint');
const fs             = require('fs');
const gulp           = require('gulp');
const gulpStep       = require('gulp-step');
const qunitHarness   = require('gulp-qunit-harness');
const mocha          = require('gulp-mocha-simple');
const mustache       = require('gulp-mustache');
const rename         = require('gulp-rename');
const webmake        = require('gulp-webmake');
const uglify         = require('gulp-uglify');
const util           = require('gulp-util');
const ll             = require('gulp-ll-next');
const gulpRunCommand = require('gulp-run-command').default;
const clone          = require('gulp-clone');
const mergeStreams   = require('merge-stream');
const path           = require('path');

gulpStep.install();

ll
    .install()
    .tasks('lint')
    .onlyInDebug([
        'server-scripts',
        'client-scripts-bundle'
    ]);

const getClientTestSettings = () => {
    return {
        basePath:        './test/client/fixtures',
        port:            2000,
        crossDomainPort: 2001,
        scripts:         [
            { src: '/hammerhead.js', path: util.env.dev ? './lib/client/hammerhead.js' : './lib/client/hammerhead.min.js' },
            { src: '/before-test.js', path: './test/client/before-test.js' }
        ],

        configApp: require('./test/client/config-qunit-server-app')
    };
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
        platform:    'macOS 10.13',
        version:     '12.0'
    },
    {
        browserName:     'Safari',
        deviceName:      'iPhone 7 Plus Simulator',
        platformVersion: '11.3',
        platformName:    'iOS'
    },
    {
        deviceName:      'Android GoogleAPI Emulator',
        browserName:     'Chrome',
        platformVersion: '7.1',
        platformName:    'Android'
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

gulp.step('client-scripts-processing', () => {
    const script = gulp.src('./src/client/index.js.wrapper.mustache')
        .pipe(mustache({ source: fs.readFileSync('./lib/client/hammerhead.js').toString() }))
        .pipe(rename('hammerhead.js'));

    const bundledScript = script.pipe(clone())
        .pipe(uglify())
        .pipe(rename('hammerhead.min.js'));

    return mergeStreams(script, bundledScript)
        .pipe(gulp.dest('./lib/client'));
});

gulp.step('client-scripts', gulp.series('client-scripts-bundle', 'client-scripts-processing'));

gulp.step('server-scripts', () => {
    const tsConfig = gulpTypeScript.createProject('tsconfig.json');
    const tsFiles  = gulp.src(['./src/**/*.ts']).pipe(tsConfig());
    const jsTools  = gulp.src(['./src/**/*.js', '!./src/client/**/*.js']);

    return mergeStreams(tsFiles, jsTools)
        .pipe(gulpBabel())
        .pipe(gulp.dest('lib/'));
});

gulp.step('shared-scripts', () => {
    // NOTE: It's a temporary solution. We just compile the shared code files and leave them in the same folder
    const tsConfig = gulpTypeScript.createProject('tsconfig.json');

    const sharedFiles = [
        './src/utils/string-trim.ts',
        './src/processing/script/header.ts',
        './src/processing/style.ts',
        './src/processing/script/index.ts',
        './src/processing/dom/internal-properties.ts',
        './src/request-pipeline/xhr/headers.ts',
        './src/request-pipeline/xhr/authorization.ts',
        './src/request-pipeline/xhr/same-origin-check-failed-status-code.ts',
        './src/utils/regexp-escape.ts',
        './src/processing/script/instruction.ts',
        './src/processing/dom/internal-attributes.ts',
        './src/utils/url.ts',
        './src/shadow-ui/class-name.ts',
        './src/processing/dom/attributes.ts',
        './src/utils/create-self-removing-script.ts',
        './src/processing/dom/index.ts',
        './src/processing/script/transform.ts',
        './src/utils/get-bom.ts',
        './src/processing/script/transformers/replace-node.ts',
        './src/processing/dom/base-dom-adapter.ts',
        './src/processing/dom/namespaces.ts',
        './src/processing/script/transformers/index.ts',
        './src/utils/get-storage-key.ts',
        './src/session/cookie-limit.ts',
        './src/utils/cookie.ts',
        './src/processing/script/instrumented.ts',
        './src/session/command.ts',
        './src/processing/script/transformers/computed-property-get.ts',
        './src/processing/script/transformers/computed-property-set.ts',
        './src/processing/script/transformers/concat-operator.ts',
        './src/processing/script/transformers/eval.ts',
        './src/processing/script/transformers/eval-bind.ts',
        './src/processing/script/transformers/eval-call-apply.ts',
        './src/processing/script/transformers/eval-get.ts',
        './src/processing/script/transformers/window-eval-get.ts',
        './src/processing/script/transformers/post-message-get.ts',
        './src/processing/script/transformers/window-post-message-get.ts',
        './src/processing/script/transformers/post-message-call-apply-bind.ts',
        './src/processing/script/transformers/for-in.ts',
        './src/processing/script/transformers/location-get.ts',
        './src/processing/script/transformers/location-property-get.ts',
        './src/processing/script/transformers/location-set.ts',
        './src/processing/script/transformers/property-get.ts',
        './src/processing/script/transformers/property-set.ts',
        './src/processing/script/transformers/method-call.ts',
        './src/processing/script/transformers/js-protocol-last-expression.ts',
        './src/processing/script/node-builder.ts',
        './src/processing/script/internal-literal.ts'
    ];

    return gulp.src(sharedFiles)
        .pipe(tsConfig())
        .pipe(gulp.dest(file => file.base));
});

gulp.step('templates', () => {
    return gulp
        .src('./src/client/task.js.mustache', { silent: false })
        .pipe(gulp.dest('./lib/client'));
});

gulp.step('lint-js', () => {
    return gulp
        .src([
            './src/client/**/*.js',
            './test/server/*.js',
            './test/client/fixtures/**/*.js',
            'Gulpfile.js'
        ])
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(eslint.failAfterError());
});

gulp.step('lint-ts', () => {
    return gulp.src('./src/**/*.ts')
        .pipe(eslint('.eslintrc-ts'))
        .pipe(eslint.format())
        .pipe(eslint.failAfterError());
});

gulp.task('lint', gulp.parallel('lint-js', 'lint-ts'));

gulp.task('build',
    gulp.series(
        'clean',
        'shared-scripts',
        gulp.parallel(
            'client-scripts',
            'server-scripts',
            'templates',
            'lint'
        )
    )
);

// Test
gulp.step('mocha', () => {
    return gulp.src('./test/server/*-test.js', { read: false })
        .pipe(mocha({
            // NOTE: Disable timeouts in debug mode.
            timeout:   typeof v8debug !== 'undefined' || !!process.debugPort ? Infinity : 2000,
            fullTrace: true
        }));
});

gulp.task('test-server', gulp.series('build', 'mocha'));

gulp.step('qunit', () => {
    gulp.watch('./src/**', gulp.series('build'));

    return gulp
        .src('./test/client/fixtures/**/*-test.js')
        .pipe(qunitHarness(getClientTestSettings()));
});

gulp.task('test-client', gulp.series('build', 'qunit'));

gulp.step('set-dev-mode', done => {
    util.env.dev = true;
    done();
});

gulp.task('test-client-dev', gulp.series('set-dev-mode', 'test-client'));

gulp.step('travis-saucelabs-qunit', () => {
    return gulp
        .src('./test/client/fixtures/**/*-test.js')
        .pipe(qunitHarness(getClientTestSettings(), SAUCELABS_SETTINGS));
});

gulp.task('test-client-travis', gulp.series('build', 'travis-saucelabs-qunit'));

gulp.step('http-playground-server', () => {
    require('./test/playground/server.js').start();

    return hang();
});

gulp.task('http-playground', gulp.series('build', 'http-playground-server'));

gulp.step('https-playground-server', () => {
    const selfSignedCertificate = require('openssl-self-signed-certificate');

    require('./test/playground/server.js').start({
        key:  selfSignedCertificate.key,
        cert: selfSignedCertificate.cert
    });

    return hang();
});

gulp.task('https-playground', gulp.series('build', 'https-playground-server'));

gulp.task('test-functional-testcafe-travis',
    gulp.series('build',
        gulpRunCommand([
            'chmod +x ./test/functional/run-testcafe-functional-tests.sh',
            './test/functional/run-testcafe-functional-tests.sh'
        ])
    )
);

gulp.task('travis', process.env.GULP_TASK ? gulp.series(process.env.GULP_TASK) : () => {});
