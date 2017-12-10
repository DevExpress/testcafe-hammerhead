var iframeSandbox = hammerhead.sandbox.iframe;
var nativeMethods = hammerhead.nativeMethods;

QUnit.testStart(function () {
    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT_EVENT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, initIframeTestHandler);
});

if (nativeMethods.performanceNow) {
    test('performanceNow', function () {
        var now = nativeMethods.performanceNow();

        ok(!isNaN(parseFloat(now)));
    });
}

if (nativeMethods.inputValueSetter) {
    test('correct value property setters are saved for the input and textarea elements', function () {
        var input                 = document.createElement('input');
        var inputValueGetter      = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').get;
        var textArea              = document.createElement('textarea');
        var textAreaValueGetter   = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').get;
        var testNativeValueSetter = function (el, setter, getter) {
            Object.defineProperty(el, 'value', {
                get: function () {
                    return getter.call(el);
                },
                set: function (value) {
                    return value;
                }
            });

            el.value = '123';

            strictEqual(el.value, '');

            setter.call(el, '123');

            strictEqual(el.value, '123');
        };

        testNativeValueSetter(input, nativeMethods.inputValueSetter, inputValueGetter);
        testNativeValueSetter(textArea, nativeMethods.textAreaValueSetter, textAreaValueGetter);
    });
}

/*eslint-disable no-unused-expressions, no-empty, no-extend-native*/
test('should use native array\'s methods in iframe without src for internal purposes (GH-1395)', function () {
    var storedArrayFilter = Array.prototype.filter;

    Array.prototype.filter = function () {
        throw new Error('Overridden Array.prototype.filter was used for internal purposes');
    };

    return createTestIframe()
        .then(function (iframe) {
            var iframeDocument = iframe.contentDocument;
            var div            = iframeDocument.createElement('div');
            var errorIsRaised  = true;

            iframeDocument.body.appendChild(div);

            try {
                var nodeList = iframeDocument.getElementsByTagName('div');

                nodeList[0];
                errorIsRaised = false;
            }
            catch (err) { }

            Array.prototype.filter = storedArrayFilter;
            notOk(errorIsRaised);
        });
});
/*eslint-enable no-unused-expressions, no-empty, no-extend-native*/
