var selectionSandbox = hammerhead.eventSandbox.selection;
var browserUtils     = hammerhead.utils.browser;
var nativeMethods    = hammerhead.nativeMethods;

var emailInputTestValue  = 'test@host.net';
var numberInputTestValue = '42';

var isSafari  = browserUtils.isSafari;
var isFirefox = browserUtils.isFirefox;

var createTestInput = function (type, value) {
    var input = document.createElement('input');

    input.setAttribute('type', type);

    document.body.appendChild(input);

    nativeMethods.inputValueSetter.call(input, value);

    return input;
};

var createNativeInput = function (type, value) {
    var input = nativeMethods.createElement.call(document, 'input');

    nativeMethods.setAttribute.call(input, 'type', type);

    nativeMethods.appendChild.call(document.body, input);

    nativeMethods.inputValueSetter.call(input, value);

    return input;
};

test('Set and get selection on input with "email" type', function () {
    var input = createTestInput('email', emailInputTestValue);

    var testSelection = {
        start:     2,
        end:       9,
        direction: 'backward',
    };

    input.setSelectionRange(testSelection.start, testSelection.end, testSelection.direction);

    var selection = selectionSandbox.getSelection(input);

    strictEqual(selection.start, testSelection.start);
    strictEqual(selection.end, testSelection.end);
    strictEqual(selection.direction, testSelection.direction);

    document.body.removeChild(input);
});

test('Selection of "email" and "number" inputs should be equal to native ones', function () {
    var emailInput          = createTestInput('email', emailInputTestValue);
    var emailInputSelection = selectionSandbox.getSelection(emailInput);
    var nativeEmailInput    = createNativeInput('email', emailInputTestValue);

    var numberInput          = createTestInput('number', numberInputTestValue);
    var numberInputSelection = selectionSandbox.getSelection(numberInput);
    var nativeNumberInput    = createNativeInput('number', numberInputTestValue);

    function checkSelection (testInputSelection, nativeInput) {
        strictEqual(testInputSelection.start, nativeInput.selectionStart);
        strictEqual(testInputSelection.end, nativeInput.selectionEnd);
        strictEqual(testInputSelection.direction, nativeInput.selectionDirection);
    }

    checkSelection(emailInputSelection, nativeEmailInput);
    checkSelection(numberInputSelection, nativeNumberInput);

    nativeMethods.removeChild.call(document.body, nativeEmailInput);
    document.body.removeChild(emailInput);
    nativeMethods.removeChild.call(document.body, nativeNumberInput);
    document.body.removeChild(numberInput);
});

test('Focus should stay on input with "number" type after setting selection', function () {
    var input = createTestInput('number', 123456789);

    var testSelection = {
        start:     2,
        end:       5,
        direction: 'backward',
    };

    input.focus();
    input.setSelectionRange(testSelection.start, testSelection.end, testSelection.direction);

    var selection = selectionSandbox.getSelection(input);

    strictEqual(selection.start, testSelection.start);
    strictEqual(selection.end, testSelection.end);
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

    if (!isFirefox)
        ok(focused);

    ok(selectionSet);
    div.focus();

    focused      = false;
    selectionSet = false;

    selectionSandbox.wrapSetterSelection(div, function () {
        selectionSet = true;
    }, true, true);

    notOk(focused);
    ok(selectionSet);
    strictEqual(document.activeElement, div);

    document.body.removeChild(div);
    start();
});

asyncTest('Focus should not be called during setting selection if editable element has been already focused (TestCafe GH - 2301)', function () {
    var input           = createTestInput('text', 'some text');
    var focused         = false;
    var shouldBeFocused = isSafari;
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

    strictEqual(focused, shouldBeFocused);
    isSelectionSet();

    input.focus();

    focused = false;

    input.setSelectionRange(startPos, endPos);

    notOk(focused);
    isSelectionSet();
    strictEqual(document.activeElement, input);

    document.body.removeChild(input);
    start();
});
