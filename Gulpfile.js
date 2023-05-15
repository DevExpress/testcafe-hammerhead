const del                   = require('del');
const eslint                = require('gulp-eslint');
const fs                    = require('fs');
const { Transform }         = require('stream');
const childProcess          = require('child_process');
const gulp                  = require('gulp');
const gulpStep              = require('gulp-step');
const qunitHarness          = require('gulp-qunit-harness');
const mocha                 = require('gulp-mocha-simple');
const mustache              = require('gulp-mustache');
const rename                = require('gulp-rename');
const uglify                = require('gulp-uglify');
const util                  = require('gulp-util');
const ll                    = require('gulp-ll-next');
const gulpRunCommand        = require('gulp-run-command').default;
const clone                 = require('gulp-clone');
const mergeStreams          = require('merge-stream');
const getClientTestSettings = require('./gulp/utils/get-client-test-settings');
const SAUCELABS_SETTINGS    = require('./gulp/saucelabs-settings');
const runPlayground         = require('./gulp/utils/run-playground');

gulpStep.install();

const needBeautifyScripts = process.argv.includes('--beautify');
const noBuild             = process.argv.includes('--no-build');

ll
    .install()
    .tasks('lint')
    .onlyInDebug([
        'server-scripts',
        'client-scripts-bundle',
    ]);

// Build
gulp.task('clean-lib', () => {
    return del(['./lib']);
});

gulp.step('client-scripts-bundle', () => {
    return childProcess
        .spawn('npx rollup -c', { shell: true, stdio: 'inherit' });
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

gulp.step('client-scripts', gulp.series('client-scripts-bundle', 'client-scripts-processing'));

// TODO: get rid of this step when we migrate to proper ES6 default imports
gulp.step('server-scripts-add-exports', () => {
    const transform = new Transform({
        objectMode: true,

        transform (file, enc, cb) {
            const fileSource = file.contents.toString();

            if (fileSource.includes('exports.default =')) {
                const sourceMapIndex = fileSource.indexOf('//# sourceMappingURL');
                const modifiedSource = fileSource.slice(0, sourceMapIndex) + 'module.exports = exports.default;\n' + fileSource.slice(sourceMapIndex);

                file.contents = Buffer.from(modifiedSource);
            }

            cb(null, file);
        },
    });

    return gulp
        .src([
            'lib/**/*.js',
            '!lib/client/**/*.js',
        ])
        .pipe(transform)
        .pipe(gulp.dest('lib'));
});

gulp.step('server-scripts', () => {
    const generateSourceMap = util.env.dev ? '--inlineSourceMap true' : '';

    return childProcess
        .spawn(`npx tsc -p tsconfig.json ${generateSourceMap}`, { shell: true, stdio: 'inherit' });
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
            '!./test/server/data/**/*.js',
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
        'server-scripts',
        'server-scripts-add-exports',
        gulp.parallel(
            'client-scripts',
            'templates',
            'lint'
        )
    )
);

const BUILD_TASK = noBuild ? () => Promise.resolve() : gulp.registry().get('build');

// Test
gulp.step('test-server-run', () => {
    return gulp.src('./test/server/**/*-test.js', { read: false })
        .pipe(mocha({
            // NOTE: Disable timeouts in debug mode.
            timeout:   typeof v8debug !== 'undefined' || !!process.debugPort ? Infinity : 2000,
            fullTrace: true,
        }));
});

gulp.step('disable-node-tls-reject-unauthorized', done => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    done();
});

gulp.task('test-server', gulp.series(BUILD_TASK, 'disable-node-tls-reject-unauthorized', 'test-server-run'));

gulp.step('test-client-run', () => {
    gulp.watch('./src/**/*.ts', BUILD_TASK);

    return gulp
        .src('./test/client/fixtures/**/*-test.js')
        .pipe(qunitHarness(getClientTestSettings()));
});

gulp.task('test-client', gulp.series(BUILD_TASK, 'test-client-run'));

gulp.step('set-dev-mode', done => {
    util.env.dev = true;
    done();
});

gulp.task('test-client-dev', gulp.series('set-dev-mode', 'test-client'));

gulp.step('test-client-cloud-run', () => {
    return gulp
        .src('./test/client/fixtures/**/*-test.js')
        .pipe(qunitHarness(getClientTestSettings(), SAUCELABS_SETTINGS));
});

gulp.task('test-client-cloud', gulp.series(BUILD_TASK, 'test-client-cloud-run'));

gulp.step('http-playground-server', () => {
    return runPlayground({ needBeautifyScripts });
});

gulp.step('set-multi-browser-mode', done => {
    process.env.allowMultipleWindows = true;

    done();
});

gulp.task('multi-window-http-playground', gulp.series(BUILD_TASK, 'set-multi-browser-mode', 'http-playground-server'));

gulp.task('http-playground', gulp.series(BUILD_TASK, 'http-playground-server'));

gulp.step('https-playground-server', () => {
    const selfSignedCertificate = require('openssl-self-signed-certificate');

    return runPlayground({
        ssl: {
            key:  selfSignedCertificate.key,
            cert: selfSignedCertificate.cert,
            needBeautifyScripts,
        },
    });
});

gulp.task('https-playground', gulp.series(BUILD_TASK, 'https-playground-server'));

gulp.step('cached-http-playground-server', () => {
    return runPlayground({ cache: true, needBeautifyScripts });
});

gulp.task('cached-http-playground', gulp.series(BUILD_TASK, 'cached-http-playground-server'));

gulp.step('test-functional-testcafe-proxy-run', gulpRunCommand([
    'chmod +x ./test/functional/run-testcafe-functional-tests.sh',
    './test/functional/run-testcafe-functional-tests.sh',
]));

gulp.task('test-functional-testcafe-proxy', gulp.series(BUILD_TASK, 'test-functional-testcafe-proxy-run'));

gulp.step('test-functional-testcafe-native-automation-run', gulpRunCommand([
    'chmod +x ./test/functional/run-testcafe-functional-tests.sh',
    './test/functional/run-testcafe-functional-tests.sh',
]));

gulp.task('test-functional-testcafe-native-automation', gulp.series(BUILD_TASK, 'test-functional-testcafe-native-automation-run'));

