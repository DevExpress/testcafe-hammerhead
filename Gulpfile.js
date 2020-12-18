const babel                 = require('@babel/core');
const gulpBabel             = require('gulp-babel');
const gulpTypeScript        = require('gulp-typescript');
const del                   = require('del');
const eslint                = require('gulp-eslint');
const fs                    = require('fs');
const gulp                  = require('gulp');
const gulpStep              = require('gulp-step');
const qunitHarness          = require('gulp-qunit-harness');
const mocha                 = require('gulp-mocha-simple');
const mustache              = require('gulp-mustache');
const rename                = require('gulp-rename');
const webmake               = require('@belym.a.2105/gulp-webmake');
const uglify                = require('gulp-uglify');
const util                  = require('gulp-util');
const ll                    = require('gulp-ll-next');
const gulpRunCommand        = require('gulp-run-command').default;
const clone                 = require('gulp-clone');
const mergeStreams          = require('merge-stream');
const path                  = require('path');
const getClientTestSettings = require('./gulp/utils/get-client-test-settings');
const SAUCELABS_SETTINGS    = require('./gulp/saucelabs-settings');
const runPlayground         = require('./gulp/utils/run-playground');

gulpStep.install();

ll
    .install()
    .tasks('lint')
    .onlyInDebug([
        'server-scripts',
        'client-scripts-bundle'
    ]);

const USE_STRICT_RE = /^(['"])use strict\1;?/;

// Build
gulp.task('clean-lib', () => {
    return del(['./lib']);
});

gulp.task('clean-outdated-js', () => {
    // NOTE: It's necessary to prevent problems related to changing file structure in the 'src' folder
    return del(['./src/**/*.js']);
});

gulp.step('client-scripts-transpile', () => {
    const tsConfig = gulpTypeScript.createProject('tsconfig.json');

    const sharedScripts = [
        './src/processing/**/*.ts',
        './src/request-pipeline/xhr/*.ts',
        './src/request-pipeline/*-header-names.ts',
        './src/shadow-ui/*.ts',
        './src/typings/*.ts',
        './src/upload/*.ts',
        './src/utils/*.ts',
        './src/session/*.ts',
        './src/proxy/service-routes.ts'
    ];

    return gulp.src(['./src/client/**/*.ts'].concat(sharedScripts))
        .pipe(tsConfig())
        .pipe(gulp.dest(file => file.base));
});

gulp.step('client-scripts-bundle', () => {
    const transform = (filename, code) => {
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
        return { code: transformed.code.replace(USE_STRICT_RE, '') };
    };

    const hammerhead = gulp.src('./src/client/index.js')
        .pipe(webmake({ sourceMap: false, transform }))
        .pipe(rename('hammerhead.js'));

    const transportWorker = gulp.src('./src/client/transport-worker/index.js')
        .pipe(webmake({ sourceMap: false, transform }))
        .pipe(rename('transport-worker.js'));

    const workerHammerhead = gulp.src('./src/client/worker/index.js')
        .pipe(webmake({ sourceMap: false, transform }))
        .pipe(rename('worker-hammerhead.js'));

    return mergeStreams(hammerhead, transportWorker, workerHammerhead)
        .pipe(gulp.dest('./lib/client'));
});

gulp.step('client-scripts-processing', () => {
    const script = gulp.src('./src/client/index.js.wrapper.mustache')
        .pipe(mustache({ source: fs.readFileSync('./lib/client/hammerhead.js').toString() }))
        .pipe(rename('hammerhead.js'));

    const bundledScript = script.pipe(clone())
        .pipe(uglify())
        .pipe(rename('hammerhead.min.js'));

    const bundledTransportWorker = gulp.src('./lib/client/transport-worker.js')
        .pipe(uglify())
        .pipe(rename('transport-worker.min.js'));

    const bundledWorkerHammerhead = gulp.src('./lib/client/worker-hammerhead.js')
        .pipe(uglify())
        .pipe(rename('worker-hammerhead.min.js'));

    return mergeStreams(script, bundledScript, bundledTransportWorker, bundledWorkerHammerhead)
        .pipe(gulp.dest('./lib/client'));
});

gulp.step('client-scripts', gulp.series('client-scripts-transpile', 'client-scripts-bundle', 'client-scripts-processing'));

gulp.step('server-scripts', () => {
    return gulp
        .src([
            './src/**/*.ts',
            '!src/client/**/*.ts'
        ])
        .pipe(gulpBabel())
        .pipe(gulp.dest('lib'));
});

gulp.step('templates', () => {
    return gulp
        .src('./src/client/task.js.mustache', { silent: false })
        .pipe(gulp.dest('./lib/client'));
});

gulp.step('lint-js', () => {
    return gulp
        .src([
            './test/server/**/*.js',
            './test/client/fixtures/**/*.js',
            './gulp/**/*.js',
            'Gulpfile.js',
            '!./test/server/data/**/*.js'
        ])
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(eslint.failAfterError());
});

gulp.step('lint-ts', () => {
    return gulp.src('./src/**/*.ts')
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(eslint.failAfterError());
});

gulp.task('lint', gulp.parallel('lint-js', 'lint-ts'));

gulp.task('build',
    gulp.series(
        'clean-lib',
        'clean-outdated-js',
        'server-scripts',
        gulp.parallel(
            'client-scripts',
            'templates',
            'lint'
        )
    )
);

// Test
gulp.step('mocha', () => {
    return gulp.src('./test/server/**/*-test.js', { read: false })
        .pipe(mocha({
            // NOTE: Disable timeouts in debug mode.
            timeout:   typeof v8debug !== 'undefined' || !!process.debugPort ? Infinity : 2000,
            fullTrace: true
        }));
});

gulp.task('test-server', gulp.series('build', 'mocha'));

gulp.step('qunit', () => {
    gulp.watch('./src/**/*.ts', gulp.series('build'));

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
    return runPlayground();
});

gulp.step('set-multi-browser-mode', done => {
    process.env.allowMultipleWindows = true;

    done();
});

gulp.task('multi-window-http-playground', gulp.series('build', 'set-multi-browser-mode', 'http-playground-server'));

gulp.task('http-playground', gulp.series('build', 'http-playground-server'));

gulp.step('https-playground-server', () => {
    const selfSignedCertificate = require('openssl-self-signed-certificate');

    return runPlayground({
        ssl: {
            key:  selfSignedCertificate.key,
            cert: selfSignedCertificate.cert
        }
    });
});

gulp.task('https-playground', gulp.series('build', 'https-playground-server'));

gulp.step('cached-http-playground-server', () => {
    return runPlayground({ cache: true });
});

gulp.task('cached-http-playground', gulp.series('build', 'cached-http-playground-server'));

gulp.task('test-functional-testcafe-travis',
    gulp.series('build',
        gulpRunCommand([
            'chmod +x ./test/functional/run-testcafe-functional-tests.sh',
            './test/functional/run-testcafe-functional-tests.sh'
        ])
    )
);

gulp.task('travis', process.env.GULP_TASK ? gulp.series(process.env.GULP_TASK) : () => {});
