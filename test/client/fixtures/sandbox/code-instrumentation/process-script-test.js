var urlUtils      = hammerhead.utils.url;
var processScript = hammerhead.utils.processing.script.processScript;
var scriptHeader  = hammerhead.utils.processing.header;
var nativeMethods = hammerhead.nativeMethods;
var browserUtils  = hammerhead.utils.browser;

var url = 'http://example.com/test';

QUnit.testStart(function () {
    // NOTE: add vars to the global context,
    // so that they can be used by eval.call
    window.anchor = document.createElement('a');

    nativeMethods.anchorHrefSetter.call(window.anchor, urlUtils.getProxyUrl(url));

    window.func = function () {
        return nativeMethods.anchorHrefGetter.call(window.anchor);
    };

    window.args = ['window.anchor.href'];
});

QUnit.testDone(function () {
    delete window.anchor;
    delete window.func;
    delete window.args;
});

function execScript (script) {
    return eval(processScript(script));
}

module('eval');

test('should process script arg', function () {
    strictEqual(execScript('eval("window.anchor.href")'), url);
});

test('should work correctly with no args', function () {
    strictEqual(execScript('eval()'), void 0);
});

test('should not process non-string args', function () {
    strictEqual(execScript('eval(window.func)').toString(), window.func.toString());
    deepEqual(execScript('eval({ test: 1} )'), { test: 1 });
    deepEqual(execScript('eval([1, 2 ,3])'), [1, 2, 3]);
});

module('eval.call');

test('should process script arg', function () {
    strictEqual(execScript('eval.call(this, "window.anchor.href")'), url);
});

test('should work correctly with no args', function () {
    strictEqual(execScript('eval.call(this)'), void 0);
});

test('should not process non-string args', function () {
    strictEqual(execScript('eval.call(this, window.func)').toString(), window.func.toString());
    deepEqual(execScript('eval.call(this, { test: 1} )'), { test: 1 });
    deepEqual(execScript('eval.call(this, [1, 2 ,3])'), [1, 2, 3]);
});

module('eval.apply');

test('should process script arg', function () {
    strictEqual(execScript('eval.apply(this, ["window.anchor.href"])'), url);
});

test('should process arguments object', function () {
    strictEqual(execScript('(function() { return eval.apply(this, arguments); })("window.anchor.href");'), url);
});

test('should not modify args array', function () {
    execScript('eval.apply(window.args)');
    deepEqual(window.args[0], 'window.anchor.href');
});

test('should not process non-string args', function () {
    strictEqual(execScript('eval.apply(this, [window.func])').toString(), window.func.toString());
    deepEqual(execScript('eval.apply(this, [{ test: 1}] )'), { test: 1 });
    deepEqual(execScript('eval.apply(this, [[1, 2 ,3]])'), [1, 2, 3]);
});

module('eval assignment');

test('the eval method should switch its own context to global', function () {
    strictEqual(execScript('window.t1="globalScope";(function()  { var t1 = "localScope", ev = eval; return ev("t1"); })()'), 'globalScope');
    strictEqual(execScript('window.t2="globalScope";(function()  { var t2 = "localScope"; return eval; })()("t2")'), 'globalScope');
    strictEqual(execScript('window.t3="globalScope";(function(ev){ var t3 = "localScope"; return ev("t3"); })(eval)'), 'globalScope');
});

test("the script processor should process eval's global", function () {
    var link    = document.createElement('a');
    var testUrl = 'http://host/index.html';

    link.setAttribute('href', testUrl);

    window['test'] = link;
    ok(nativeMethods.getAttribute.call(link, 'href') !== testUrl);
    strictEqual(execScript('var ev = eval; ev("test.href")'), testUrl);
});


module('destructuring');

var defaultRestArrayStr = 'var ' + scriptHeader.add('')
    .replace(/[\s\S]+(__rest\$Array\s*=\s*function[^}]+})[\s\S]+/g, '$1');
var defaultArrayFromStr = 'var ' + scriptHeader.add('')
    .replace(/[\s\S]+(__arrayFrom\$\s*=\s*function[^}]+})[\s\S]+/g, '$1');

test('destructuring object with rest element', function () {
    var script = 'let obj = { a: 1, b: 2, c: 3, d: 4 };' +
                     'let { a, "b": i, j = 7, ...other } = obj;' +
                     'window.destructingResult = "" + a + i + j + JSON.stringify(other);';

    var defaultRestObjectStr = 'var ' + scriptHeader.add('')
        .replace(/[\s\S]+(__rest\$Object\s*=\s*function[\s\S]+?return[^}]+})[\s\S]+/g, '$1');

    eval(defaultRestObjectStr + ';' + processScript(script));

    strictEqual(window.destructingResult, '127{"c":3,"d":4}');

    window.destructingResult = void 0;

    eval(processScript(script));

    strictEqual(window.destructingResult, '127{"c":3,"d":4}');
});

test('destructuring array with rest element', function () {
    var script = 'let arr = [1, 2, 3, 4];' +
                     'let [ a, b = 9, ...other ] = arr;' +
                     'window.destructingResult = "" + a + b + JSON.stringify(other);';


    eval(defaultRestArrayStr + ';' + processScript(script));

    strictEqual(window.destructingResult, '12[3,4]');

    window.destructingResult = void 0;

    eval(processScript(script));

    strictEqual(window.destructingResult, '12[3,4]');
});

test('destructuring iterable', function () {
    var script = 'const iterable = {};' +
            'iterable[Symbol.iterator] = function* () { yield 1; yield 2; };' +
            'let a, b = 9;' +
            '[a, b] = iterable;' +
            'window.destructingResult = "" + a + b;';

    eval(defaultArrayFromStr + ';' + processScript(script));

    strictEqual(window.destructingResult, '12');

    window.destructingResult = void 0;

    eval(processScript(script));

    strictEqual(window.destructingResult, '12');
});

test('destructuring iterable with rest element', function () {
    var script = 'const iterable = {};' +
            'iterable[Symbol.iterator] = function* () { yield 1; yield 2; yield 3; yield 4; };' +
            'let [ a, b = 9, ...other ] = iterable;' +
            'window.destructingResult = "" + a + b + JSON.stringify(other);';

    eval(defaultRestArrayStr + ';' + defaultArrayFromStr + ';' + processScript(script));

    strictEqual(window.destructingResult, '12[3,4]');

    window.destructingResult = void 0;

    eval(processScript(script));

    strictEqual(window.destructingResult, '12[3,4]');
});

test('destructuring for...of iterable', function () {
    var script = 'window.destructingResult = "";' +
            'const iterable = {};' +
            'iterable[Symbol.iterator] = function* () { yield 1; yield 2; yield 3; yield 4; };' +
            'for (const item of iterable) window.destructingResult += item;';

    eval(defaultArrayFromStr + ';' + processScript(script));

    strictEqual(window.destructingResult, '1234');

    window.destructingResult = void 0;

    eval(processScript(script));

    strictEqual(window.destructingResult, '1234');
});

test('destructuring nested for...of iterable', function () {
    var script = 'window.destructingResult = "";\n' +
            'let item1, item2;' +
            'const iterable = {};' +
            'iterable[Symbol.iterator] = function* () { yield [1,2]; yield [3,4]; };' +
            'for (let a of [iterable, iterable]) {' +
            '    for ([item1, item2] of a) {' +
            '        window.destructingResult += item1;' +
            '        window.destructingResult += item2;' +
            '    }' +
            '}';

    eval(defaultArrayFromStr + ';' + processScript(script));

    strictEqual(window.destructingResult, '12341234');

    window.destructingResult = void 0;

    eval(processScript(script));

    strictEqual(window.destructingResult, '12341234');
});

test('should process script arg', function () {
    strictEqual(execScript('({ a: b } = { a: null }).a'), null);
});

if (!browserUtils.isIOS) {
    test('private identifier and property definition', function () {
        var script = `const {T:xc}={},Nc=class s{static#e=this.field="test";}; window.output = Nc.field`;

        eval(processScript(script));

        strictEqual(window.output, 'test');
    });
}

if (!browserUtils.isSafari || browserUtils.version >= 16.4) {
    test('static blocks', function () {
        var script = `const {T:xc}={},Nc=class s{static{this.field="test"};}; window.output = Nc.field`;

        eval(processScript(script));

        strictEqual(window.output, 'test');
    });
}

module('others');

test('optional chaining', function () {
    var testCases = [
        {
            src:      'var obj = null; window.optionChainingResult = obj?.href;',
            expected: void 0,
        },
        {
            src:      'var obj = { href: "123" }; window.optionChainingResult = obj?.href;',
            expected: '123',
        },
        {
            src:      'var obj = null; window.optionChainingResult = obj?.["href"];',
            expected: void 0,
        },
        {
            src:      'var obj = null; var counter = 0; window.optionChainingResult = obj?.[counter -1];',
            expected: void 0,
        },
        {
            src:      'var obj = null; var counter = 0; window.optionChainingResult = obj?.href[counter];',
            expected: void 0,
        },
    ];

    var additionalCases = [];

    // NOTE: Safari until iOS 13.4 don't have full support optional chaining
    if (!browserUtils.isIOS || browserUtils.compareVersions([browserUtils.webkitVersion, '608.2.11']) === 1) {
        var additionalCases = [
            {
                src:      'var obj = { href: "123" }; window.optionChainingResult = obj?.["href"];',
                expected: '123',
            },
            {
                src:      'var obj = {}; window.optionChainingResult = obj["href"]?.();',
                expected: void 0,
            },
        ];

        for (let i = 0; i < additionalCases.length; i++)
            testCases.push(additionalCases[i]);
    }

    for (var i = 0; i < testCases.length; i++) {
        var testCase = testCases[i];
        var script   = processScript(testCase.src);

        eval(script);

        strictEqual(window.optionChainingResult, testCase.expected);

        delete window.optionChainingResult;
        delete window.obj;
    }
});
