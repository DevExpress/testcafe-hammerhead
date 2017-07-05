test('mark all internal properties as non-enumerable (GH-1182)', function () {
    var documentEnumerableProperties  = Object.keys(document);
    var windowEnumerableProperties    = Object.keys(window);
    var elementEnumerableProperties   = Object.keys(document.body);
    var hasEnumerableInternalProperty = function (propName) {
        // Used for tests
        if (propName === 'hammerhead')
            return false;

        return propName.indexOf('hammerhead') !== -1;
    };

    for (var i = 0; i < documentEnumerableProperties.length; i++) {
        var documentEnumerableProperty = documentEnumerableProperties[i];

        ok(!hasEnumerableInternalProperty(documentEnumerableProperty), documentEnumerableProperty);
    }

    for (var j = 0; j < windowEnumerableProperties.length; j++) {
        var windowEnumerableProperty = windowEnumerableProperties[j];

        ok(!hasEnumerableInternalProperty(windowEnumerableProperty), windowEnumerableProperty);
    }

    for (var k = 0; k < elementEnumerableProperties.length; k++) {
        var elementEnumerableProperty = elementEnumerableProperties[k];

        ok(!hasEnumerableInternalProperty(elementEnumerableProperty), elementEnumerableProperty);
    }
});

