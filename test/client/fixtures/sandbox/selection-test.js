var selectionSandbox = hammerhead.eventSandbox.selection;
var browserUtils     = hammerhead.utils.browser;
var nativeMethods    = hammerhead.nativeMethods;

var inputTestValue  = 'test@host.net';
// var isChrome        = browserUtils.isChrome;
var isSafari        = browserUtils.isSafari;
var isFirefox       = browserUtils.isFirefox;
var isIE            = browserUtils.isIE;
var isIE11          = browserUtils.isIE11;
// var isAndroid       = browserUtils.isAndroid;
// var browserVersion  = browserUtils.version;
// var isMobileBrowser = browserUtils.isIOS || isAndroid;
var isMacPlatform   = browserUtils.isMacPlatform;

var FOCUS_TIMEOUT = isIE11 ? 100 : 0;

var createTestInput = function (type, value) {
    var input = document.createElement('input');

    input.setAttribute('type', type);

    document.body.appendChild(input);

    nativeMethods.inputValueSetter.call(input, value);

    return input;
};

test('Set and get selection on input with "email" type', function () {
    var input = createTestInput('email', inputTestValue);

    var testSelection = {
        start:     2,
        end:       9,
        direction: 'backward'
    };

    input.setSelectionRange(testSelection.start, testSelection.end, testSelection.direction);

    var selection = selectionSandbox.getSelection(input);

    strictEqual(selection.start, testSelection.start);
    strictEqual(selection.end, testSelection.end);

    if (!isIE)
        strictEqual(selection.direction, testSelection.direction);

    document.body.removeChild(input);
});

test('!!! Get selection on input with "email" type', function () {
    var input     = createTestInput('email', inputTestValue);
    var selection = selectionSandbox.getSelection(input);

    var expectedPosition;

    if (isSafari)
        expectedPosition = inputTestValue.length;
    else if (isIE)
        expectedPosition = 0;
    else
        expectedPosition = null;

    strictEqual(selection.start, expectedPosition);
    strictEqual(selection.end, expectedPosition);

    var isDirectionSupported = isSafari;
    var expectedDirection = isMacPlatform ? 'none' : 'forward';

    if (isDirectionSupported)
        strictEqual(selection.direction, expectedDirection);

    document.body.removeChild(input);
});

test('Focus should stay on input with "number" type after setting selection', function () {
    var input = createTestInput('number', 123456789);

    var testSelection = {
        start:     2,
        end:       5,
        direction: 'backward'
    };

    input.focus();
    input.setSelectionRange(testSelection.start, testSelection.end, testSelection.direction);

    var selection = selectionSandbox.getSelection(input);

    strictEqual(selection.start, testSelection.start);
    strictEqual(selection.end, testSelection.end);

    if (!isIE)
        strictEqual(selection.direction, testSelection.direction);

    strictEqual(document.activeElement, input);
    document.body.removeChild(input);
});

asyncTest('Focus should not be called during setting selection if conteneditable element has been already focused (TestCafe GH - 2301)', function () {
    var div = document.createElement('div');

    div.setAttribute('contenteditable', 'true');
    div.textContent = 'some text';

    document.body.appendChild(div);

    var focused      = false;
    var selectionSet = false;

    div.addEventListener('focus', function () {
        focused = true;
    });

    selectionSandbox.wrapSetterSelection(div, function () {
        selectionSet = true;
    }, true, true);

    window.setTimeout(function () {
        if (!isFirefox)
            ok(focused);

        ok(selectionSet);
        div.focus();

        window.setTimeout(function () {
            focused      = false;
            selectionSet = false;

            selectionSandbox.wrapSetterSelection(div, function () {
                selectionSet = true;
            }, true, true);

            window.setTimeout(function () {
                notOk(focused);
                ok(selectionSet);
                strictEqual(document.activeElement, div);

                document.body.removeChild(div);
                start();
            }, FOCUS_TIMEOUT);
        }, FOCUS_TIMEOUT);
    }, FOCUS_TIMEOUT);
});

asyncTest('Focus should not be called during setting selection if editable element has been already focused (TestCafe GH - 2301)', function () {
    var input           = createTestInput('text', 'some text');
    var focused         = false;
    var shouldBeFocused = isIE || isSafari;
    var startPos        = 1;
    var endPos          = 3;

    var isSelectionSet = function () {
        strictEqual(input.selectionStart, startPos);
        strictEqual(input.selectionEnd, endPos);
    };

    input.addEventListener('focus', function () {
        focused = true;
    });

    input.setSelectionRange(startPos, endPos);

    window.setTimeout(function () {
        strictEqual(focused, shouldBeFocused);
        isSelectionSet();

        input.focus();

        window.setTimeout(function () {
            focused = false;

            input.setSelectionRange(startPos, endPos);

            window.setTimeout(function () {
                notOk(focused);
                isSelectionSet();
                strictEqual(document.activeElement, input);

                document.body.removeChild(input);
                start();
            }, FOCUS_TIMEOUT);
        }, FOCUS_TIMEOUT);
    }, FOCUS_TIMEOUT);
});
