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

test('wrappers of native functions should return the correct string representations', function () {
    window.checkStringRepresentation(window.Element.prototype.setAttribute, nativeMethods.setAttribute,
        'Element.prototype.setAttribute');
    window.checkStringRepresentation(window.Element.prototype.setAttributeNS, nativeMethods.setAttributeNS,
        'Element.prototype.setAttributeNS');
    window.checkStringRepresentation(window.Element.prototype.getAttribute, nativeMethods.getAttribute,
        'Element.prototype.getAttribute');
    window.checkStringRepresentation(window.Element.prototype.getAttributeNS, nativeMethods.getAttributeNS,
        'Element.prototype.getAttributeNS');
    window.checkStringRepresentation(window.Element.prototype.removeAttribute, nativeMethods.removeAttribute,
        'Element.prototype.removeAttribute');
    window.checkStringRepresentation(window.Element.prototype.removeAttributeNS, nativeMethods.removeAttributeNS,
        'Element.prototype.removeAttributeNS');
    window.checkStringRepresentation(window.Element.prototype.removeAttributeNode, nativeMethods.removeAttributeNode,
        'Element.prototype.removeAttributeNode');
    window.checkStringRepresentation(window.Element.prototype.cloneNode, nativeMethods.cloneNode,
        'Element.prototype.cloneNode');
    window.checkStringRepresentation(window.Element.prototype.querySelector, nativeMethods.elementQuerySelector,
        'Element.prototype.querySelector');
    window.checkStringRepresentation(window.Element.prototype.querySelectorAll, nativeMethods.elementQuerySelectorAll,
        'Element.prototype.querySelectorAll');
    window.checkStringRepresentation(window.Element.prototype.hasAttribute, nativeMethods.hasAttribute,
        'Element.prototype.hasAttribute');
    window.checkStringRepresentation(window.Element.prototype.hasAttributeNS, nativeMethods.hasAttributeNS,
        'Element.prototype.hasAttributeNS');
    window.checkStringRepresentation(window.Element.prototype.hasAttributes, nativeMethods.hasAttributes,
        'Element.prototype.hasAttributes');
    window.checkStringRepresentation(window.Node.prototype.cloneNode, nativeMethods.cloneNode,
        'Node.prototype.cloneNode');
    window.checkStringRepresentation(window.Node.prototype.appendChild, nativeMethods.appendChild,
        'Node.prototype.appendChild');
    window.checkStringRepresentation(window.Node.prototype.removeChild, nativeMethods.removeChild,
        'Node.prototype.removeChild');
    window.checkStringRepresentation(window.Node.prototype.insertBefore, nativeMethods.insertBefore,
        'Node.prototype.insertBefore');
    window.checkStringRepresentation(window.Node.prototype.replaceChild, nativeMethods.replaceChild,
        'Node.prototype.replaceChild');
    window.checkStringRepresentation(window.DocumentFragment.prototype.querySelector,
        nativeMethods.documentFragmentQuerySelector,
        'DocumentFragment.prototype.querySelector');
    window.checkStringRepresentation(window.DocumentFragment.prototype.querySelectorAll,
        nativeMethods.documentFragmentQuerySelectorAll,
        'DocumentFragment.prototype.querySelectorAll');
    window.checkStringRepresentation(window.HTMLTableElement.prototype.insertRow, nativeMethods.insertTableRow,
        'HTMLTableElement.prototype.insertRow');
    window.checkStringRepresentation(window.HTMLTableSectionElement.prototype.insertRow, nativeMethods.insertTableRow,
        'HTMLTableSectionElement.prototype.insertRow');
    window.checkStringRepresentation(window.HTMLTableRowElement.prototype.insertCell, nativeMethods.insertCell,
        'HTMLTableRowElement.prototype.insertCell');
    window.checkStringRepresentation(window.HTMLFormElement.prototype.submit, nativeMethods.formSubmit,
        'HTMLFormElement.prototype.submit');
    window.checkStringRepresentation(window.HTMLAnchorElement.prototype.toString, nativeMethods.anchorToString,
        'HTMLAnchorElement.prototype.toString');
    window.checkStringRepresentation(window.CharacterData.prototype.appendData, nativeMethods.appendData,
        'CharacterData.prototype.appendData');

    if (window.Document.prototype.registerElement) {
        window.checkStringRepresentation(window.Document.prototype.registerElement, nativeMethods.registerElement,
            'Document.prototype.registerElement');
    }

    if (window.Element.prototype.insertAdjacentHTML) {
        window.checkStringRepresentation(window.Element.prototype.insertAdjacentHTML, nativeMethods.insertAdjacentHTML,
            'Element.prototype.insertAdjacentHTML');
    }
    else if (HTMLElement.prototype.insertAdjacentHTML) {
        window.checkStringRepresentation(window.HTMLElement.prototype.insertAdjacentHTML,
            nativeMethods.insertAdjacentHTML,
            'HTMLElement.prototype.insertAdjacentHTML');
    }

    const someElement = document.createElement('div');

    window.checkStringRepresentation(someElement.addEventListener, nativeMethods.addEventListener,
        'element.addEventListener');
    window.checkStringRepresentation(someElement.removeEventListener, nativeMethods.removeEventListener,
        'element.removeEventListener');
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

test('dynamic base (GH-1965)', function () {
    return createTestIframe({ src: getSameDomainPageUrl('../../../data/node-sandbox/dynamic-base-tag.html') })
        .then(function (iframe) {
            strictEqual(iframe.contentWindow.testpassed, '/sessionId!s/https://example.com/testpassed/script-url.js');
        });
});
