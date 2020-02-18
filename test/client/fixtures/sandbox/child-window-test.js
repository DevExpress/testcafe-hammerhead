var ChildWindowSandbox = hammerhead.get('./sandbox/child-window');
var defaultTarget      = hammerhead.get('./sandbox/child-window/default-target');
var settings           = hammerhead.get('./settings');

var windowSandbox = hammerhead.sandbox.node.win;

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
