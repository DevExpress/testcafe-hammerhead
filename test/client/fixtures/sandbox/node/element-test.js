test('check the "scriptElementEvent" event is raised', function () {
    var script = document.createElement('script');

    function handler (e) {
        strictEqual(e.el, script);

        hammerhead.off(hammerhead.EVENTS.scriptElementAdded, handler);
    }

    hammerhead.on(hammerhead.EVENTS.scriptElementAdded, handler);

    document.body.appendChild(script);
    expect(1);
});
