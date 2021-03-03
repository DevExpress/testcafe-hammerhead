import path from 'path';
import resolve from '@rollup/plugin-node-resolve';
import typescript from 'rollup-plugin-typescript2';
import commonjs from '@rollup/plugin-commonjs';

const TARGET_DIR = 'lib/client';

const CHUNKS = [
    { input: 'src/client/index.ts', output: 'hammerhead.js' },
    { input: 'src/client/transport-worker/index.ts', output: 'transport-worker.js' },
    { input: 'src/client/worker/index.ts', output: 'worker-hammerhead.js' }
];

const CONFIG = CHUNKS.map(chunk => ({
    input: chunk.input,
    output: {
        file:    path.join(TARGET_DIR, chunk.output),
        format:  'iife',
        // NOTE: 'use strict' in our scripts can break user code
        // https://github.com/DevExpress/testcafe/issues/258
        strict:  false
    },
    plugins: [
        resolve(),
        typescript({
            tsconfig: 'src/client/tsconfig.json',
            include: [
                'src/**/*.ts',
                // NOTE: transpile the acorn-hammerhead package because it has non-ES5 compatible code
                'node_modules/acorn-hammerhead/**/*.js'
            ],
            rollupCommonJSResolveHack: true
        }),
        commonjs()
    ],
    onwarn (warning, rollupWarn) {
        if (warning.code === 'CIRCULAR_DEPENDENCY')
            return;

        if (warning.code === 'MISSING_NAME_OPTION_FOR_IIFE_EXPORT')
            return;

        rollupWarn(warning);
    }
}));

export default CONFIG;
