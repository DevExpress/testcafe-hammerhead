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

module('wrappers of native functions should return the correct string representations', function () {
    test('Element.prototype.setAttribute', function () {
        window.checkStringRepresentation(window.Element.prototype.setAttribute, nativeMethods.setAttribute);
    });

    test('Element.prototype.setAttributeNS', function () {
        window.checkStringRepresentation(window.Element.prototype.setAttributeNS, nativeMethods.setAttributeNS);
    });

    test('Element.prototype.getAttribute', function () {
        window.checkStringRepresentation(window.Element.prototype.getAttribute, nativeMethods.getAttribute);
    });

    test('Element.prototype.getAttributeNS', function () {
        window.checkStringRepresentation(window.Element.prototype.getAttributeNS, nativeMethods.getAttributeNS);
    });

    test('Element.prototype.removeAttribute', function () {
        window.checkStringRepresentation(window.Element.prototype.removeAttribute, nativeMethods.removeAttribute);
    });

    test('Element.prototype.removeAttributeNS', function () {
        window.checkStringRepresentation(window.Element.prototype.removeAttributeNS, nativeMethods.removeAttributeNS);
    });

    test('Element.prototype.cloneNode', function () {
        window.checkStringRepresentation(window.Element.prototype.cloneNode, nativeMethods.cloneNode);
    });

    test('Element.prototype.querySelector', function () {
        window.checkStringRepresentation(window.Element.prototype.querySelector, nativeMethods.elementQuerySelector);
    });

    test('Element.prototype.querySelectorAll', function () {
        window.checkStringRepresentation(window.Element.prototype.querySelectorAll, nativeMethods.elementQuerySelectorAll);
    });

    test('Element.prototype.hasAttribute', function () {
        window.checkStringRepresentation(window.Element.prototype.hasAttribute, nativeMethods.hasAttribute);
    });

    test('Element.prototype.hasAttributeNS', function () {
        window.checkStringRepresentation(window.Element.prototype.hasAttributeNS, nativeMethods.hasAttributeNS);
    });

    test('Element.prototype.hasAttributes', function () {
        window.checkStringRepresentation(window.Element.prototype.hasAttributes, nativeMethods.hasAttributes);
    });

    test('Node.prototype.cloneNode', function () {
        window.checkStringRepresentation(window.Node.prototype.cloneNode, nativeMethods.cloneNode);
    });

    test('Node.prototype.appendChild', function () {
        window.checkStringRepresentation(window.Node.prototype.appendChild, nativeMethods.appendChild);
    });

    test('Node.prototype.removeChild', function () {
        window.checkStringRepresentation(window.Node.prototype.removeChild, nativeMethods.removeChild);
    });

    test('Node.prototype.insertBefore', function () {
        window.checkStringRepresentation(window.Node.prototype.insertBefore, nativeMethods.insertBefore);
    });

    test('Node.prototype.replaceChild', function () {
        window.checkStringRepresentation(window.Node.prototype.replaceChild, nativeMethods.replaceChild);
    });

    test('DocumentFragment.prototype.querySelector', function () {
        window.checkStringRepresentation(window.DocumentFragment.prototype.querySelector, nativeMethods.documentFragmentQuerySelector);
    });

    test('DocumentFragment.prototype.querySelectorAll', function () {
        window.checkStringRepresentation(window.DocumentFragment.prototype.querySelectorAll, nativeMethods.documentFragmentQuerySelectorAll);
    });

    test('HTMLTableElement.prototype.insertRow', function () {
        window.checkStringRepresentation(window.HTMLTableElement.prototype.insertRow, nativeMethods.insertTableRow);
    });

    test('HTMLTableSectionElement.prototype.insertRow', function () {
        window.checkStringRepresentation(window.HTMLTableSectionElement.prototype.insertRow, nativeMethods.insertTableRow);
    });

    test('HTMLTableRowElement.prototype.insertCell', function () {
        window.checkStringRepresentation(window.HTMLTableRowElement.prototype.insertCell, nativeMethods.insertCell);
    });

    test('HTMLFormElement.prototype.submit', function () {
        window.checkStringRepresentation(window.HTMLFormElement.prototype.submit, nativeMethods.formSubmit);
    });

    test('HTMLAnchorElement.prototype.toString', function () {
        window.checkStringRepresentation(window.HTMLAnchorElement.prototype.toString, nativeMethods.anchorToString);
    });

    test('CharacterData.prototype.appendData', function () {
        window.checkStringRepresentation(window.CharacterData.prototype.appendData, nativeMethods.appendData);
    });

    if (window.Document.prototype.registerElement) {
        test('Document.prototype.registerElement', function () {
            window.checkStringRepresentation(window.Document.prototype.registerElement, nativeMethods.registerElement);
        });
    }

    if (window.Element.prototype.insertAdjacentHTML) {
        test('Element.prototype.insertAdjacentHTML', function () {
            window.checkStringRepresentation(window.Element.prototype.insertAdjacentHTML, nativeMethods.insertAdjacentHTML);
        });
    }
    else if (HTMLElement.prototype.insertAdjacentHTML) {
        test('HTMLElement.prototype.insertAdjacentHTML', function () {
            window.checkStringRepresentation(window.HTMLElement.prototype.insertAdjacentHTML, nativeMethods.insertAdjacentHTML);
        });
    }
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
