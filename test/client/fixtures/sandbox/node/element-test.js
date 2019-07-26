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

test('prevent form submit', function () {
    var form            = document.createElement('form');
    var submitPrevented = false;

    form.setAttribute('action', 'non-existing-url');

    document.body.appendChild(form);

    hammerhead.on(hammerhead.EVENTS.beforeFormSubmit, function (e) {
        e.preventSubmit = true;

        submitPrevented = true;
    });

    form.submit();

    strictEqual(submitPrevented, true);
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

test('[registerElement] the lifecycle callbacks should not be called twice (GH-695)', function () {
    if (!document.registerElement) {
        expect(0);
        return;
    }

    var createdCallbackCalledCount  = 0;
    var attachedCallbackCalledCount = 0;
    var detachedCallbackCalledCount = 0;
    var newTagProto                 = Object.create(HTMLElement.prototype);

    newTagProto.createdCallback  = function () {
        createdCallbackCalledCount++;
    };
    newTagProto.attachedCallback = function () {
        attachedCallbackCalledCount++;
    };
    newTagProto.detachedCallback = function () {
        detachedCallbackCalledCount++;
    };

    var NewTag         = document.registerElement('new-tag', { prototype: newTagProto });
    var newTagInstance = new NewTag();
    var testDiv        = document.createElement('div');

    document.body.appendChild(testDiv);

    testDiv.appendChild(newTagInstance);
    testDiv.removeChild(newTagInstance);

    strictEqual(createdCallbackCalledCount, 1);
    strictEqual(attachedCallbackCalledCount, 1);
    strictEqual(detachedCallbackCalledCount, 1);

    createdCallbackCalledCount  = 0;
    attachedCallbackCalledCount = 0;
    detachedCallbackCalledCount = 0;

    testDiv.innerHTML = '<new-tag/>';
    testDiv.innerHTML = '';

    strictEqual(createdCallbackCalledCount, 1);
    strictEqual(attachedCallbackCalledCount, 1);
    strictEqual(detachedCallbackCalledCount, 1);

    document.body.removeChild(testDiv);
});
