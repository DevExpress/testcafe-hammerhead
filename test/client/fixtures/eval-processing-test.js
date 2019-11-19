var processScript = hammerhead.get('../processing/script').processScript;
var aIsNotDefinedRegExp = /(['"])?a\1? is (not |un)defined/;

test('1 Should throw an error that the a is not defined', function () {
    var script = [
        'var x = eval;',
        'function f () {',
        '    var a = 4;',
        '    return x("a + 5");',
        '}',
        'f();'
    ].join('\n');

    throws(function () {
        eval(script);
    }, aIsNotDefinedRegExp);

    throws(function () {
        eval(processScript(script));
    }, aIsNotDefinedRegExp);
});

test('2 Should throw an error that the a is not defined', function () {
    var script = [
        'function f () {',
        '    var x = eval;',
        '    var a = 4;',
        '    return x.call(window, "a + 5");',
        '}',
        'f();'
    ].join('\n');

    throws(function () {
        eval(script);
    }, aIsNotDefinedRegExp);

    throws(function () {
        eval(processScript(script));
    }, aIsNotDefinedRegExp);
});
