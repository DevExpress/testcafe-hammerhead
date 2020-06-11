var urlUtils      = hammerhead.get('./utils/url');
var processScript = hammerhead.get('../processing/script').processScript;
var scriptHeader  = hammerhead.get('../processing/script/header');

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

test('the script processor should process eval\'s global', function () {
    var link    = document.createElement('a');
    var testUrl = 'http://host/index.html';

    link.setAttribute('href', testUrl);

    window['test'] = link;
    ok(nativeMethods.getAttribute.call(link, 'href') !== testUrl);
    strictEqual(execScript('var ev = eval; ev("test.href")'), testUrl);
});

module('destructuring');

if (!browserUtils.isIE11) {
    test('destructuring object with rest element', function () {
        var script = 'let obj = { a: 1, b: 2, c: 3, d: 4 };' +
                     'let { a, "b": i, j = 7, ...other } = obj;' +
                     'window.destructingResult = "" + a + i + j + JSON.stringify(other);';

        var defaultRestObjectStr = 'var ' + scriptHeader.add('')
            .replace(/[\s\S]+(__rest\$Object\s*=\s*function[\s\S]+return[^}]+})[\s\S]+/g, '$1');

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

        var defaultRestObjectStr = 'var ' + scriptHeader.add('')
            .replace(/[\s\S]+(__rest\$Array\s*=\s*function[^}]+})[\s\S]+/g, '$1');

        eval(defaultRestObjectStr + ';' + processScript(script));

        strictEqual(window.destructingResult, '12[3,4]');

        window.destructingResult = void 0;

        eval(processScript(script));

        strictEqual(window.destructingResult, '12[3,4]');
    });
}
