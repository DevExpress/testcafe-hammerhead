var ChildWindowSandbox = hammerhead.get('./sandbox/child-window');
var defaultTarget      = hammerhead.get('./sandbox/child-window/default-target');
var settings           = hammerhead.get('./settings');

var windowSandbox = hammerhead.sandbox.node.win;
var nativeMethods = hammerhead.nativeMethods;

test('_shouldOpenInNewWindow', function () {
    window.name = 'test-window-name';

    notOk(ChildWindowSandbox._shouldOpenInNewWindow(null, defaultTarget.linkOrArea));
    notOk(ChildWindowSandbox._shouldOpenInNewWindow('', defaultTarget.linkOrArea));
    ok(ChildWindowSandbox._shouldOpenInNewWindow('_blank', defaultTarget.linkOrArea));
    ok(ChildWindowSandbox._shouldOpenInNewWindow('_Blank', defaultTarget.linkOrArea));
    ok(ChildWindowSandbox._shouldOpenInNewWindow('wrong-window-name', defaultTarget.linkOrArea));
    notOk(ChildWindowSandbox._shouldOpenInNewWindow('test-window-name', defaultTarget.linkOrArea));
    notOk(ChildWindowSandbox._shouldOpenInNewWindow(null, defaultTarget.form));
    ok(ChildWindowSandbox._shouldOpenInNewWindow(null, defaultTarget.windowOpen));

    window.name = '';
});

test('window.open', function () {
    settings.get().allowMultipleWindows = true;

    windowSandbox._childWindowSandbox.handleWindowOpen = function (window, args) {
        strictEqual(args[1], '_blank');
    };

    window.open('/test');

    settings.get().allowMultipleWindows = false;
});

module('regression');

test('should be prevented only default behaviour (GH-2467)', function () {
    settings.get().allowMultipleWindows = true;

    var anchor                   = document.createElement('a');
    var isClickTriggered         = false;
    var storedOpenUrlInNewWindow = windowSandbox._childWindowSandbox._openUrlInNewWindow;

    anchor.href        = '/path/';
    anchor.target      = '_blank';
    anchor.textContent = 'click';

    document.body.appendChild(anchor);

    anchor.addEventListener('click', function () {
        isClickTriggered = true;
    });

    windowSandbox._childWindowSandbox._openUrlInNewWindow = window.noop;

    nativeMethods.click.call(anchor);

    return window.QUnitGlobals.wait(function () {
        return isClickTriggered;
    }, 5000)
        .then(function () {
            ok(true);

            settings.get().allowMultipleWindows = false;
            windowSandbox._childWindowSandbox._openUrlInNewWindow = storedOpenUrlInNewWindow;
            document.body.removeChild(anchor);
        });
});
