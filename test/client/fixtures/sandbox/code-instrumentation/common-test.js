var jsProcessor         = Hammerhead.jsProcessor;
var codeInstrumentation = Hammerhead.sandbox.codeInstrumentation;

test('wrapped properties equals with accessors properties', function () {
    codeInstrumentation.attach(window);

    var elementPropertyAccessorsKeys = Object.keys(codeInstrumentation.elementPropertyAccessors);
    var wrappedProperties            = Object.keys(jsProcessor.wrappedProperties);

    strictEqual(elementPropertyAccessorsKeys.length, wrappedProperties.length);

    for (var i = 0; i < wrappedProperties.length; i++)
        ok(elementPropertyAccessorsKeys.indexOf(wrappedProperties[i]) !== -1, wrappedProperties[i]);
});
