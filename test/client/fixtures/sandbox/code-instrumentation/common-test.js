var INSTRUMETNED_PROPERTIES = hammerhead.get('../processing/js/instrumented').PROPERTIES;
var codeInstrumentation     = hammerhead.sandbox.codeInstrumentation;

test('wrapped properties equal accessors properties', function () {
    codeInstrumentation.attach(window);

    var elementPropertyAccessorsKeys = Object.keys(codeInstrumentation.elementPropertyAccessors);

    strictEqual(elementPropertyAccessorsKeys.length, INSTRUMETNED_PROPERTIES.length);

    for (var i = 0; i < INSTRUMETNED_PROPERTIES.length; i++)
        ok(elementPropertyAccessorsKeys.indexOf(INSTRUMETNED_PROPERTIES[i]) > -1, INSTRUMETNED_PROPERTIES[i]);
});
