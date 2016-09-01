var domUtils      = hammerhead.utils.dom;
var browserUtils  = hammerhead.utils.browser;
var iframeSandbox = hammerhead.sandbox.iframe;

var EXPECTED_FOCUSED_ELEMENT_CLASS = 'expected';

QUnit.testStart(function () {
    document.getElementById('qunit-tests').style.display = 'none';
    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    document.getElementById('qunit-tests').style.display = '';
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
});

function toArray (arg) {
    var arr    = [];
    var length = arg.length;

    for (var i = 0; i < length; i++)
        arr.push(arg[i]);

    return arr;
}

asyncTest('find all focusable elements', function () {
    var iframe = document.createElement('iframe');
    var src    = window.QUnitGlobals.getResourceUrl('../data/is-focusable/iframe.html', 'is-focusable/iframe.html');

    iframe.setAttribute('src', src);

    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            var iframeDocument          = iframe.contentDocument;
            var allElements             = iframeDocument.querySelectorAll('*');
            var expectedFocusedElements = toArray(iframeDocument.querySelectorAll('.' +
                                                                                  EXPECTED_FOCUSED_ELEMENT_CLASS));
            var focusedElements         = [];

            if (browserUtils.isIE) {
                expectedFocusedElements = expectedFocusedElements.filter(function (el) {
                    if (browserUtils.version <= 10 && domUtils.isAnchorElement(el) && el.getAttribute('href') === '')
                        return false;

                    return !domUtils.isOptionElement(el);
                });
            }

            for (var i = 0; i < allElements.length; i++) {
                if (domUtils.isElementFocusable(allElements[i]))
                    focusedElements.push(allElements[i]);
            }

            deepEqual(expectedFocusedElements, focusedElements);

            document.body.removeChild(iframe);
            start();
        });

    iframe.id           = 'test_unique' + Date.now();
    iframe.style.width  = '500px';
    iframe.style.height = '500px';

    document.body.appendChild(iframe);
});
