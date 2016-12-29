test('Check the "scriptElementEvent" event is raised', function () {
    window.script = document.createElement('script');

    function handler (e) {
        strictEqual(e.el, window.script);

        hammerhead.off(hammerhead.EVENTS.scriptElementAdded, handler);
    }

    hammerhead.on(hammerhead.EVENTS.scriptElementAdded, handler);

    eval(processScript('document.body.appendChild(window.script)'));
    expect(1);
});
