var ChildWindowSandbox = hammerhead.get('./sandbox/child-window');

test('_shouldOpenInNewWindow', function () {
    window.name = 'test-window-name';

    notOk(ChildWindowSandbox._shouldOpenInNewWindow(null));
    notOk(ChildWindowSandbox._shouldOpenInNewWindow(''));
    ok(ChildWindowSandbox._shouldOpenInNewWindow('_blank'));
    ok(ChildWindowSandbox._shouldOpenInNewWindow('_Blank'));
    ok(ChildWindowSandbox._shouldOpenInNewWindow('wrong-window-name'));
    notOk(ChildWindowSandbox._shouldOpenInNewWindow('test-window-name'));

    window.name = '';
});
