var nativeMethods = hammerhead.nativeMethods;

test('check the "scriptElementEvent" event is raised', function () {
    var script1           = document.createElement('script');
    var addedScriptsCount = 0;
    var scripts           = [];

    function handler (e) {
        strictEqual(e.el, scripts[addedScriptsCount]);

        ++addedScriptsCount;
    }

    hammerhead.on(hammerhead.EVENTS.scriptElementAdded, handler);

    scripts.push(script1);

    document.body.appendChild(script1);

    strictEqual(addedScriptsCount, 1);

    var fragment = document.createDocumentFragment();

    var script2 = document.createElement('script');
    var script3 = document.createElement('script');

    fragment.appendChild(script2);
    fragment.appendChild(script3);

    strictEqual(addedScriptsCount, 1);

    scripts.push(script2, script3);

    document.body.appendChild(fragment);

    strictEqual(addedScriptsCount, 3);

    var div     = document.createElement('div');
    var script4 = document.createElement('script');

    div.appendChild(script4);

    strictEqual(addedScriptsCount, 3);

    scripts.push(script4);

    document.body.appendChild(div);

    strictEqual(addedScriptsCount, 4);

    hammerhead.off(hammerhead.EVENTS.scriptElementAdded, handler);
});

module('regression');

test('a document fragment should correctly process when it is appending to iframe (GH-912)', function () {
    return createTestIframe()
        .then(function (iframe) {
            var fragment = document.createDocumentFragment();
            var anchor   = document.createElement('a');

            anchor.href = 'http://example.com/';
            anchor.text = 'Anchor';

            fragment.appendChild(anchor);

            strictEqual(nativeMethods.anchorHrefGetter.call(anchor), location.origin + '/sessionId/http://example.com/');

            iframe.contentDocument.body.appendChild(fragment);

            strictEqual(nativeMethods.anchorHrefGetter.call(anchor), location.origin + '/sessionId!i/http://example.com/');
        });
});
