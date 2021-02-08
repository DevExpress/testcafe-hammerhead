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
        strict:  false,
        // NOTE: we need it to modify behaviour of different modules in client tests
        freeze:  false
    },
    plugins: [
        resolve(),
        typescript({
            tsconfig: 'src/client/tsconfig.json',
            include: ['*.+(j|t)s', '**/*.+(j|t)s'],
            rollupCommonJSResolveHack: true
        }),
        commonjs()
    ]
}));

export default CONFIG;
