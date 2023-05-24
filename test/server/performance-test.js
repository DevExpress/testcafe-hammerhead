const { expect }       = require('chai');
const acorn            = require('acorn-hammerhead');
const processScript    = require('../../lib/processing/script').processScript;
const transformProgram = require('../../lib/processing/script/transform');
const parseUrl         = require('../../lib/utils/url').parseUrl;
const getFirstDestUrl  = require('../../lib/utils/stack-processing').getFirstDestUrl;
const styleProcessor   = require('../../lib/processing/style');
const fs               = require('fs');
const getRandomString  = require('../../lib/utils/generate-unique-id');

describe('Performance', () => {
    it('getFirstDestUrl', () => {
        const stack = `AssertionError: ops
              at Context.<anonymous> (D:\\Work\\testcafe-hammerhead\\test\\server\\performance-test.js:75:31)
              at callFn (D:\\Work\\testcafe-hammerhead\\node_modules\\mocha\\lib\\runnable.js:374:21)
              at Test.Runnable.run (D:\\Work\\testcafe-hammerhead\\node_modules\\mocha\\lib\\runnable.js:361:7)
              at Runner.runTest (http://localhost:1337/session*1234!utf-8/file:///D:/Work/testcafe-hammerhead/node_modules/mocha/lib/runner.js:619:10)
              at D:\\Work\\testcafe-hammerhead\\node_modules\\mocha\\lib\\runner.js:745:12
              at next (D:\\Work\\testcafe-hammerhead\\node_modules\\mocha\\lib\\runner.js:536:14)
              at D:\\Work\\testcafe-hammerhead\\node_modules\\mocha\\lib\\runner.js:546:7
              at next (D:\\Work\\testcafe-hammerhead\\node_modules\\mocha\\lib\\runner.js:448:14)
              at Immediate._onImmediate (D:\\Work\\testcafe-hammerhead\\node_modules\\mocha\\lib\\runner.js:514:5)`;

        const start = new Date().getTime();

        for (let i = 0; i < 200000; i++)
            getFirstDestUrl(stack);

        const executionTime = new Date().getTime() - start;

        expect(executionTime).below(4000);
    });

    it('parseUrl', () => {
        const urls = [
            'http://host:12/wkjfkjsdfhjksdhf',
            'http://host/wkjfkjsdfhjksdhf',
            '     http://auth@host/wkjfkjsdfhjksdhf    ',
            'about:blank',
            'file:///wkjfkjsdfhjksdhf',
        ];

        const start = new Date().getTime();

        for (let i = 0; i < 500000; i++) {
            for (const url of urls)
                parseUrl(url);
        }

        const executionTime = new Date().getTime() - start;

        expect(executionTime).below(3000);
    });

    it('"beforeTransform" of the script processing (GH-TC-6297)', () => {
        const scripts = [
            'import("y")',
            'obj[x].y',
            'var x = 9;',
            'while (true);',
            'if (x == 9) console.log(9);',
        ];

        // NOTE: emulate client side
        global.window = {};

        const start = new Date().getTime();

        for (let i = 0; i < 20000; i++) {
            for (const script of scripts)
                transformProgram(acorn.parse(script, { allowImportExportEverywhere: true, ecmaVersion: 11 }), false, () => '');
        }

        delete global.window;

        const executionTime = new Date().getTime() - start;

        expect(executionTime).below(6000);
    });

    it('acorn "wordsRegexp" function (GH-TC-6297)', () => {
        const start = new Date().getTime();

        for (let i = 0; i < 250000; i++)
            processScript('obj[x].y');

        const executionTime = new Date().getTime() - start;

        expect(executionTime).below(6000);
    });

    it('style process', () => {
        const style       = fs.readFileSync('test/server/data/stylesheet/src.css').toString();
        const css         = (getRandomString(50000) + style).repeat(100);
        const urlReplacer = url => url;

        const start = new Date().getTime();

        styleProcessor.process(css, urlReplacer);

        const executionTime = new Date().getTime() - start;

        expect(executionTime).below(100);
    });
});
