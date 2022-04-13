var INSTRUMETNED_PROPERTIES = hammerhead.utils.processing.instrumentation.PROPERTIES;
var codeInstrumentation     = hammerhead.sandbox.codeInstrumentation;
var nativeMethods           = hammerhead.nativeMethods;

test('wrapped properties equal accessors properties', function () {
    var propertyAccessorsKeys = Object.keys(codeInstrumentation._propertyAccessorsInstrumentation.constructor._ACCESSORS);

    strictEqual(propertyAccessorsKeys.length, INSTRUMETNED_PROPERTIES.length);

    for (var i = 0; i < INSTRUMETNED_PROPERTIES.length; i++)
        ok(propertyAccessorsKeys.indexOf(INSTRUMETNED_PROPERTIES[i]) > -1, INSTRUMETNED_PROPERTIES[i]);
});

if (nativeMethods.Proxy) {
    test('we should unwrap the eval function through our Proxy wrapper (GH-2434, GH-2003)', function () {
        var code = [
            'with (arguments[0]) {',
            '    const { data } = arguments[0];',
            '    return function() {',
            '        "use strict";',
            '        return eval(arguments[0]);',
            '    };',
            '}',
        ];

        // eslint-disable-next-line no-new-func
        var evalFactory = new Function(code.join('\n'));
        var testObj     = { data: { a: 777 } };
        var proxy       = new Proxy(testObj, {
            get: function (target, name) {
                if (name === 'eval')
                    return window.getEval(window.eval);

                return target[name];
            },
            has: function (target, name) {
                return name === 'eval' || name in target;
            },
        });

        evalFactory(proxy)('strictEqual(data.a, 777);');
    });
}
