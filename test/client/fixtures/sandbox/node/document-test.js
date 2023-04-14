var processScript           = hammerhead.utils.processing.script.processScript;
var SHADOW_UI_CLASSNAME     = hammerhead.SHADOW_UI_CLASS_NAME;
var INTERNAL_PROPS          = hammerhead.PROCESSING_INSTRUCTIONS.dom.internal_props;
var urlUtils                = hammerhead.utils.url;
var destLocation            = hammerhead.utils.destLocation;
var overriding              = hammerhead.utils.overriding;
var settings                = hammerhead.settings;

var browserUtils  = hammerhead.utils.browser;
var nativeMethods = hammerhead.nativeMethods;
var Promise       = hammerhead.Promise;
var shadowUI      = hammerhead.sandbox.shadowUI;

test('document.write for iframe.src with javascript protocol', function () {
    var $div = $('<div>').appendTo('body');

    processDomMeth($div[0]);

    var $iframe = $('<iframe id="test4" src="javascript:&quot;<html><body><a id=\'link\' href=\'http://google.com/\'></body></html>&quot;"></iframe>"');

    $div[0].appendChild($iframe[0]);
    ok(!overriding.isNativeFunction($iframe[0].contentDocument.write), 'iframe.contentDocument.write should be overridden');

    $iframe.remove();
});

asyncTest('document.write for iframe with empty url', function () {
    var $div   = $('<div>').appendTo('body');
    var cheked = false;

    processDomMeth($div[0]);

    var $iframe = $('<iframe id="test3" src="about:blank">');

    var check = function () {
        var document = $iframe[0].contentDocument;

        if (document)
            ok(!overriding.isNativeFunction(document.write), 'document.write should be overridden');
    };

    check();

    $iframe.ready(check);
    $iframe.load(function () {
        check();

        var id = setInterval(function () {
            if (cheked) {
                clearInterval(id);
                $iframe.remove();
                start();
            }
        }, 10);

    });

    $div[0].appendChild($iframe[0]);
    check();
    cheked = true;
});

if (!browserUtils.isFirefox) {
    test('override document after document.write calling', function () {
        var $div    = $('<div>').appendTo('body');
        var $sdiv   = $('<div>').appendTo('body');
        var $iframe = $('<iframe id="test11" src="about:blank">"');
        var iframe  = $iframe[0];

        var checkIframeDocumentOverrided = function () {
            var document = iframe.contentDocument;
            var result   = true;

            if (document) {
                if (overriding.isNativeFunction(document.write))
                    result = false;
            }

            // NOTE: Stack overflow check.
            ok(!document || !!document.getElementsByTagName('body'));
            ok(!!window.top.document.getElementsByTagName('body'));

            ok(result);
        };

        var checkWriteFunction = function () {
            checkIframeDocumentOverrided();
            iframe.contentDocument.open();
            checkIframeDocumentOverrided();
            iframe.contentDocument.write('<div></div>');
            checkIframeDocumentOverrided();
            iframe.contentDocument.close();
            checkIframeDocumentOverrided();

            iframe.contentDocument.open();
            checkIframeDocumentOverrided();
            iframe.contentDocument.write('<html><body><a href="http://google.com/"></body></html>');
            checkIframeDocumentOverrided();
            iframe.contentDocument.close();
            checkIframeDocumentOverrided();
        };

        $iframe.ready(checkIframeDocumentOverrided);
        $iframe.load(checkIframeDocumentOverrided);

        // NOTE: After appended to DOM.
        $div[0].appendChild(iframe);
        checkWriteFunction();

        // NOTE: After reinserted to DOM.
        $sdiv[0].appendChild(iframe);
        checkWriteFunction();

        $iframe.remove();
        $sdiv.remove();
        $div.remove();
    });
}

test('wrappers of native functions should return the correct string representations', function () {
    window.checkStringRepresentation(window[nativeMethods.documentOpenPropOwnerName].prototype.open,
        nativeMethods.documentOpen,
        nativeMethods.documentOpenPropOwnerName + '.prototype.open');
    window.checkStringRepresentation(window[nativeMethods.documentClosePropOwnerName].prototype.close,
        nativeMethods.documentClose,
        nativeMethods.documentClosePropOwnerName + '.prototype.close');
    window.checkStringRepresentation(window[nativeMethods.documentWritePropOwnerName].prototype.write,
        nativeMethods.documentWrite,
        nativeMethods.documentWritePropOwnerName + '.prototype.write');
    window.checkStringRepresentation(window[nativeMethods.documentWriteLnPropOwnerName].prototype.writeln,
        nativeMethods.documentWriteLn,
        nativeMethods.documentWriteLnPropOwnerName + '.prototype.writeln');
    window.checkStringRepresentation(document.open, nativeMethods.documentOpen, 'document.open');
    window.checkStringRepresentation(document.close, nativeMethods.documentClose, 'document.close');
    window.checkStringRepresentation(document.write, nativeMethods.documentWrite, 'document.write');
    window.checkStringRepresentation(document.writeln, nativeMethods.documentWriteLn, 'document.writeln');
    window.checkStringRepresentation(window.Document.prototype.createElement, nativeMethods.createElement,
        'Document.prototype.createElement');
    window.checkStringRepresentation(window.Document.prototype.createElementNS, nativeMethods.createElementNS,
        'Document.prototype.createElementNS');
    window.checkStringRepresentation(window.Document.prototype.createDocumentFragment,
        nativeMethods.createDocumentFragment,
        'Document.prototype.createDocumentFragment');
});

module('querySelector, querySelectorAll (GH-340)');

test('quote types in attribute selectors', function () {
    var anchor = document.createElement('a');

    anchor.setAttribute('href', 'http://some.domain.com');
    document.body.appendChild(anchor);

    ok(document.querySelector('[href="http://some.domain.com"]'));
    ok(document.querySelector("[href='http://some.domain.com']"));

    anchor.parentNode.removeChild(anchor);
});

test('non-processed attributes', function () {
    var anchor = document.createElement('a');

    anchor.setAttribute('data-info', 'external anchor');
    anchor.setAttribute('hreflang', 'ru-RU');
    document.body.appendChild(anchor);

    ok(document.querySelector('[data-info~=external]'));
    ok(document.querySelector('[hreflang|=ru]'));

    anchor.parentNode.removeChild(anchor);
});

//http://www.w3.org/TR/css3-selectors/#attribute-selectors
test('attrubute types', function () {
    var anchor = document.createElement('a');
    var div    = document.createElement('div');

    anchor.setAttribute('href', 'http://some.domain.com');
    anchor.setAttribute('action', 'edit');
    div.className = 'container';
    div.appendChild(anchor);

    document.body.appendChild(div);

    // [attribute]
    ok(div.querySelector('[href]'));

    // [attribute=value]
    ok(document.querySelector('[href="http://some.domain.com"]'));
    ok(document.querySelector('[action=edit]'));

    // [attribute~=value] - whitespace-separated values
    // Proxied attributes don't contain whitespace-separated values

    // [attribute|=value] - equal or starts with for value that ends with '-'
    // This is primarily intended to allow language subcode matches

    // [attribute^=value] - starts with
    ok(document.querySelector('[href^="http://some"]'));

    // [attribute$=value] - ends with
    ok(document.querySelector('[href$="domain.com"]'));

    // [attribute*=value] - contains value
    ok(document.querySelector('[href*=domain]'));
    anchor.parentNode.removeChild(anchor);
});

test('document, documentFragment, element', function () {
    var link         = document.createElement('a');
    var div          = document.createElement('div');
    var fragment     = document.createDocumentFragment();
    var fragmentLink = document.createElement('a');

    link.setAttribute('href', 'http://some.domain.com');
    fragmentLink.setAttribute('href', 'http://some.domain.com');
    div.appendChild(link);
    document.body.appendChild(div);
    fragment.appendChild(fragmentLink);

    ok(document.querySelector('a[href="http://some.domain.com"]'));
    strictEqual(document.querySelectorAll('a[href="http://some.domain.com"]').length, 1);
    ok(div.querySelector('[href="http://some.domain.com"]'));
    strictEqual(div.querySelectorAll('[href="http://some.domain.com"]').length, 1);
    ok(fragment.querySelector('a[href="http://some.domain.com"]'));
    strictEqual(fragment.querySelectorAll('a[href="http://some.domain.com"]').length, 1);

    div.parentNode.removeChild(div);
});

test('non-added to DOM', function () {
    var link = document.createElement('a');
    var div  = document.createElement('div');

    link.setAttribute('href', 'http://some.domain.com');
    div.appendChild(link);

    ok(div.querySelector('[href="http://some.domain.com"]'));
});

test('javascript protocol', function () {
    var anchor = document.createElement('a');

    anchor.setAttribute('href', 'javascript:performCommand(cmd);');
    document.body.appendChild(anchor);

    ok(document.querySelector('[href="javascript:performCommand(cmd);"]'));

    anchor.parentNode.removeChild(anchor);
});

test('complex selector', function () {
    var link     = document.createElement('a');
    var divOuter = document.createElement('div');
    var divInner = document.createElement('div');

    divOuter.setAttribute('data-id', '123456');
    divInner.className = 'inner';
    link.setAttribute('href', 'http://some.domain.com');
    divOuter.appendChild(divInner);
    divInner.appendChild(link);
    document.body.appendChild(divOuter);

    ok(document.querySelector('div[data-id="123456"] div.inner a[href="http://some.domain.com"]'));

    divOuter.parentNode.removeChild(divOuter);
});

// http://w3c-test.org/dom/nodes/ParentNode-querySelector-All.html
test('special selectors', function () {
    var div = document.createElement('div');

    div.appendChild(document.createElement('null'));
    div.appendChild(document.createElement('undefined'));

    ok(div.querySelector(null));
    ok(div.querySelectorAll(void 0));
});

test('parameters passed to the native function in its original form', function () {
    checkNativeFunctionArgs('createElement', 'createElement', document);
    checkNativeFunctionArgs('createElementNS', 'createElementNS', document);
    checkNativeFunctionArgs('createDocumentFragment', 'createDocumentFragment', document);
    checkNativeFunctionArgs('elementFromPoint', 'elementFromPoint', document);

    if (document.caretRangeFromPoint)
        checkNativeFunctionArgs('caretRangeFromPoint', 'caretRangeFromPoint', document);

    if (document.caretPositionFromPoint)
        checkNativeFunctionArgs('caretPositionFromPoint', 'caretPositionFromPoint', document);

    checkNativeFunctionArgs('getElementById', 'getElementById', document);
    checkNativeFunctionArgs('getElementsByClassName', 'getElementsByClassName', document);
    checkNativeFunctionArgs('getElementsByName', 'getElementsByName', document);
    checkNativeFunctionArgs('getElementsByTagName', 'getElementsByTagName', document);
    checkNativeFunctionArgs('querySelector', 'querySelector', document);
    checkNativeFunctionArgs('querySelectorAll', 'querySelectorAll', document);
    checkNativeFunctionArgs('addEventListener', 'addEventListener', document);
    checkNativeFunctionArgs('removeEventListener', 'removeEventListener', document);

    var storedBeforeDocumentCleaned = hammerhead.sandbox.node.doc._beforeDocumentCleaned;
    var storedRestoreDocumentMeths  = nativeMethods.restoreDocumentMeths;

    hammerhead.sandbox.node.doc._beforeDocumentCleaned = nativeMethods.restoreDocumentMeths = function () {
    };

    checkNativeFunctionArgs('close', 'documentClose', document);
    checkNativeFunctionArgs('open', 'documentOpen', document);

    hammerhead.sandbox.node.doc._beforeDocumentCleaned = storedBeforeDocumentCleaned;
    nativeMethods.restoreDocumentMeths                 = storedRestoreDocumentMeths;
});

module('overridden descriptors');

if (nativeMethods.documentDocumentURIGetter) {
    test('document.documentURI', function () {
        var savedDocumentURIGetter = nativeMethods.documentDocumentURIGetter;

        nativeMethods.documentDocumentURIGetter = function () {
            return 'http://example.com/';
        };

        strictEqual(document.documentURI, 'http://example.com/');

        nativeMethods.documentDocumentURIGetter = function () {
            return urlUtils.getProxyUrl('http://example.com/');
        };

        strictEqual(document.documentURI, 'http://example.com/');

        nativeMethods.documentDocumentURIGetter = savedDocumentURIGetter;
    });
}

test('document.referrer', function () {
    var savedDocumentReferrerGetter = nativeMethods.documentReferrerGetter;

    nativeMethods.documentReferrerGetter = function () {
        return '';
    };

    strictEqual(document.referrer, '');

    nativeMethods.documentReferrerGetter = function () {
        return urlUtils.getProxyUrl('http://example.com/');
    };

    strictEqual(document.referrer, 'http://example.com/');

    nativeMethods.documentReferrerGetter = function () {
        return urlUtils.getProxyUrl('about:blank');
    };

    strictEqual(document.referrer, '');

    nativeMethods.documentReferrerGetter = savedDocumentReferrerGetter;
});

test('document.URL', function () {
    strictEqual(document.URL, 'https://example.com/');
});

test('document.domain', function () {
    strictEqual(document.domain, 'example.com');

    document.domain = 'localhost';

    strictEqual(document.domain, 'localhost');
});

test('document.styleSheets (GH-1000)', function () {
    var styleSheetsCollectionLength = document.styleSheets.length;
    var shadowStyleSheet            = document.createElement('style');

    shadowUI.addClass(shadowStyleSheet, 'ui-stylesheet');
    document.body.appendChild(shadowStyleSheet);

    strictEqual(styleSheetsCollectionLength, document.styleSheets.length);

    var styleSheet = document.createElement('style');

    document.body.appendChild(styleSheet);

    strictEqual(styleSheetsCollectionLength + 1, document.styleSheets.length);
    strictEqual(styleSheet, document.styleSheets.item(document.styleSheets.length - 1).ownerNode);

    shadowStyleSheet.parentNode.removeChild(shadowStyleSheet);
    styleSheet.parentNode.removeChild(styleSheet);
});

test('document.cookie', function () {
    document.cookie = 'document=cookie';

    strictEqual(document.cookie, 'document=cookie');
    strictEqual(nativeMethods.documentCookieGetter.call(document).indexOf('document=cookie'), -1);

    settings.get().cookie = '';

    strictEqual(document.cookie, '');
});

test('document.cookie on page with file protocol', function () {
    destLocation.forceLocation('http://localhost/sessionId/file:///path/index.html');

    strictEqual(document.cookie = 'test=123', 'test=123');
    strictEqual(document.cookie, '');

    destLocation.forceLocation('http://localhost/sessionId/https://example.com');
});

test('document.activeElement', function () {
    var shadowRoot  = shadowUI.getRoot();
    var input       = document.createElement('input');
    var shadowInput = document.createElement('input');

    document.body.appendChild(input);
    shadowRoot.appendChild(shadowInput);

    strictEqual(document.activeElement, document.body);

    shadowInput.focus();

    return window.wait(0)
        .then(function () {
            strictEqual(document.activeElement, document.body);
            strictEqual(nativeMethods.documentActiveElementGetter.call(document), shadowInput);

            input.focus();

            return window.wait(0);
        })
        .then(function () {
            strictEqual(document.activeElement, input);
            strictEqual(nativeMethods.documentActiveElementGetter.call(document), input);

            shadowInput.focus();

            return window.wait(0);
        })
        .then(function () {
            strictEqual(document.activeElement, input);
            strictEqual(nativeMethods.documentActiveElementGetter.call(document), shadowInput);

            document.body.removeChild(input);
            shadowRoot.removeChild(shadowInput);
        });
});

test('document.activeElement when it equals null (GH-1226)', function () {
    var parentDiv = document.createElement('div');
    var childDiv  = document.createElement('div');

    parentDiv.id      = 'div';
    childDiv.id       = 'innerDiv';
    childDiv.tabIndex = 0;

    parentDiv.appendChild(childDiv);
    document.body.appendChild(parentDiv);

    childDiv.focus();
    nativeMethods.elementInnerHTMLSetter.call(parentDiv, '<span>Replaced</span>');

    try {
        strictEqual(document.activeElement, nativeMethods.documentActiveElementGetter.call(document));
    }
    catch (err) {
        ok(false);
    }

    document.body.removeChild(parentDiv);
});

if (nativeMethods.nodeBaseURIGetter) {
    test('document.baseURI (GH-920)', function () {
        var savedNodeBaseURIGetter = nativeMethods.nodeBaseURIGetter;

        nativeMethods.nodeBaseURIGetter = function () {
            return urlUtils.getProxyUrl('http://example.com/');
        };

        strictEqual(document.baseURI, 'http://example.com/');

        nativeMethods.nodeBaseURIGetter = function () {
            return 'http://example.com/';
        };

        strictEqual(document.baseURI, 'http://example.com/');

        nativeMethods.nodeBaseURIGetter = savedNodeBaseURIGetter;
    });
}

test('should override document methods on a prototype level (GH-1827)', function () {
    expect(1);

    var savedCreateElement = window.Document.prototype.createElement;

    window.Document.prototype.createElement = function () {
        window.Document.prototype.createElement = savedCreateElement;

        ok(true);
    };

    document.createElement('div');
});

test('patching Node methods on the client side: appendChild, insertBefore, replaceChild, removeChild (GH-1874)', function () {
    expect(8);

    function checkMeth (methName) {
        strictEqual(window.Node.prototype[methName], window.HTMLBodyElement.prototype[methName], methName);

        var savedMeth = window.Node.prototype[methName];

        window.Node.prototype[methName] = function () {
            window.Node.prototype[methName] = savedMeth;

            ok(true, methName);
        };

        document.body[methName]();
    }

    [
        'appendChild',
        'insertBefore',
        'replaceChild',
        'removeChild',
    ].forEach(function (methName) {
        checkMeth(methName);
    });
});

module('document.title', {
    beforeEach: function () {
        nativeMethods.documentTitleSetter.call(document, 'Test title');
    },
    afterEach: function () {
        strictEqual(nativeMethods.documentTitleGetter.call(document), 'Test title', 'check into afterEach hook');
    },
});

test('basic', function () {
    strictEqual(document.title, '');
    strictEqual(document.title = 'end-user title', 'end-user title');
});

test('text properties of the first <title> element', function () {
    var titles = document.getElementsByTagName('title');

    strictEqual(titles.length, 1);

    var title = titles[0];

    title.text = 'text-title';

    strictEqual(document.title, 'text-title');
    strictEqual(title.text, 'text-title');

    title.innerText = 'innerText-title';

    strictEqual(document.title, 'innerText-title');
    strictEqual(title.innerText, 'innerText-title');

    title.textContent = 'textContent-title';

    strictEqual(document.title, 'textContent-title');
    strictEqual(title.textContent, 'textContent-title');

    title.innerHTML = 'innerHTML-title';

    strictEqual(document.title, 'innerHTML-title');
    strictEqual(title.innerHTML, 'innerHTML-title');

    document.title = '';
});

test('several <title> nodes', function () {
    var titles     = document.getElementsByTagName('title');
    var firstTitle = titles[0];

    strictEqual(titles.length, 1);
    strictEqual(firstTitle.text, '');
    strictEqual(document.title, '');

    var secondTitle = document.createElement('title');

    secondTitle.text = 'Second title';

    strictEqual(secondTitle.text, 'Second title');
    strictEqual(document.title, '');

    document.head.appendChild(secondTitle);

    secondTitle.text = 'Updated second title';

    strictEqual(document.title, '');

    firstTitle.text = 'Updated first title';

    strictEqual(document.title, 'Updated first title');

    secondTitle.parentNode.removeChild(secondTitle);
});

test('undefined', function () {
    document.title = void 0;

    strictEqual(document.title, 'undefined');

    var firstTitle = document.head.querySelector('title');

    firstTitle.text = void 0;

    strictEqual(firstTitle.text, 'undefined');
});

test('add/remove nodes', function () {
    var titles      = document.getElementsByTagName('title');
    var firstTitle  = titles[0];

    firstTitle.text  = 'First title';

    strictEqual(document.title, 'First title');

    var secondTitle = document.createElement('title');

    secondTitle.text = 'Second title';

    document.head.insertBefore(secondTitle, firstTitle);

    strictEqual(document.title, 'Second title');

    secondTitle.parentNode.removeChild(secondTitle);

    strictEqual(document.title, 'First title');
});

test('<title> from another window', function () {
    document.title = 'Test title';

    return createTestIframe()
        .then(function (iframe) {
            var titleElement = iframe.contentDocument.createElement('title');

            iframe.contentDocument.head.appendChild(titleElement);

            titleElement.text = 'Title for iframe';

            strictEqual(document.title, 'Test title');
        });
});

test('creation via set "innerHTML" or "outerHTML"', function () {
    var div = document.createElement('div');

    div.innerHTML = '<div id="d1"><title>Title from innerHTML</title></div>';

    document.body.appendChild(div);

    var title = div.getElementsByTagName('title')[0];

    strictEqual(title.text, 'Title from innerHTML');

    div.firstChild.outerHTML = '<div id="d2"><div><title>Title from outerHTML</title></div></div>';

    title = div.getElementsByTagName('title')[0];

    strictEqual(title.text, 'Title from outerHTML');
});

test("SVG's <title> element (GH-2364)", function () {
    var div = document.createElement('div');

    div.innerHTML =
        '<svg viewBox="0 0 20 10" xmlns="http://www.w3.org/2000/svg">' +
        '  <circle cx="5" cy="5" r="4">' +
        '    <title>I am a circle</title>' +
        '  </circle>' +
        '</svg>';

    document.body.appendChild(div);

    var title = div.getElementsByTagName('title')[0];

    strictEqual(title.textContent, 'I am a circle');

    div.parentNode.removeChild(div);
});

test('creation via "innerHTML" in iframe', function () {
    return createTestIframe()
        .then(function (iframe) {
            var html = '<head><title>Test title</title></head><body></body>';

            iframe.contentDocument.documentElement.innerHTML = html;

            strictEqual(iframe.contentDocument.title, 'Test title');
        });
});

module('regression');

test('document.write for several tags in iframe (T215136)', function () {
    return createTestIframe({ src: getSameDomainPageUrl('../../../data/node-sandbox/iframe-with-doc-write.html') })
        .then(function (iframe) {
            var div = iframe.contentDocument.querySelector('#parent');

            strictEqual(div.children.length, 3);
            strictEqual(div.parentNode.lastElementChild, div);
        });
});

test('document.write for page html (T190753)', function () {
    var $div            = $('<div>').appendTo('body');
    var $iframe         = $('<iframe id="test5">');
    var script          = 'var a = [1,2], b = 0; window.test = a[b];';
    var processedScript = processScript(script, true).replace(/\s*/g, '');

    processDomMeth($div[0]);
    $div[0].appendChild($iframe[0]);

    ok(script.replace(/\s*/g, '') !== processedScript);

    $iframe[0].contentDocument.write('<html><head><script>' + script + '<' + '/script><head><body></body></html>');

    strictEqual($iframe[0].contentWindow.test, 1);

    var scripts = $iframe[0].contentDocument.getElementsByTagName('script');

    strictEqual(scripts.length, 1);
    strictEqual(nativeMethods.scriptTextGetter.call(scripts[0]).replace(/\s*/g, ''), processedScript);

    $iframe.remove();
    $div.remove();
});

if (browserUtils.isFirefox) {
    asyncTest('override window methods after document.write call (T239109)', function () {
        var iframe = document.createElement('iframe');

        iframe.id                 = 'test_wrapper';
        window.top.onIframeInited = function (window) {
            var iframeIframeSandbox = window['%hammerhead%'].sandbox.iframe;

            iframeIframeSandbox.on(iframeIframeSandbox.RUN_TASK_SCRIPT_EVENT, initIframeTestHandler);
            iframeIframeSandbox.off(iframeIframeSandbox.RUN_TASK_SCRIPT_EVENT, iframeIframeSandbox.iframeReadyToInitHandler);
        };

        iframe.setAttribute('src', 'javascript:\'' +
                                   '   <html><body><script>' +
                                   '       window.top.onIframeInited(window);' +
                                   '       var quote = String.fromCharCode(34);' +
                                   '       if(true){document.write("<iframe id=" + quote + "test_iframe" + quote + "></iframe>");}' +
                                   '       if(true){document.getElementById("test_iframe").contentDocument.write("<body><script>document.body.innerHTML = " + quote + "<div></div>" + quote + ";</s" + "cript></body>");}' +
                                   '   </sc' + 'ript></body></html>' +
                                   '\'');

        document.body.appendChild(iframe);

        var id = setInterval(function () {
            var testIframe = iframe.contentDocument.getElementById('test_iframe');

            if (testIframe && testIframe.contentDocument.body.children[0].tagName.toLowerCase() === 'div') {
                clearInterval(id);
                ok(true);
                iframe.parentNode.removeChild(iframe);

                start();
            }
        }, 10);

    });
}

if (!browserUtils.isFirefox) {
    test('document.write([]) in iframe (T239131)', function () {
        return createTestIframe()
            .then(function (iframe) {
                // NOTE: Some browsers remove their documentElement after a "write([])" call. Previously, if the
                // documentElement was null, "processDomMethodName" failed with the 'Maximum call stack size exceeded' error.
                iframe.contentDocument.write([]);
                ok(true);
                iframe.contentDocument.close();
            });
    });
}

asyncTest('the onDocumentCleaned event is not raised after calling document.write (GH-253)', function () {
    expect(1);

    var iframe  = document.createElement('iframe');
    var src     = getSameDomainPageUrl('../../../data/node-sandbox/iframe-without-document-cleaned-event.html');
    var handler = function (e) {
        window.removeEventListener('message', handler);
        strictEqual(e.data, 'success');
        iframe.parentNode.removeChild(iframe);
        start();
    };

    window.addEventListener('message', handler);
    iframe.setAttribute('src', src);
    document.body.appendChild(iframe);
});

asyncTest('document elements are overridden after document.write has been called (GH-253)', function () {
    var iframe = document.createElement('iframe');

    iframe.id  = 'test';
    iframe.src = getSameDomainPageUrl('../../../data/node-sandbox/iframe-override-elems-after-write.html');

    var onMessageHandler = function (e) {
        window.removeEventListener('message', onMessageHandler);

        var rawData = e.data;
        var data    = rawData instanceof Object ? rawData : JSON.parse(rawData);

        strictEqual(data.length, 3);

        data.forEach(function (testResult) {
            ok(testResult.success, testResult.description);
        });

        iframe.parentNode.removeChild(iframe);

        start();
    };

    window.addEventListener('message', onMessageHandler);

    document.body.appendChild(iframe);
});

test('multiple document.write with html and body tags should not break markup (GH-387)', function () {
    var src = getSameDomainPageUrl('../../../data/node-sandbox/multiple-write-with-html-and-body-tags.html');

    return createTestIframe({ src: src })
        .then(function (iframe) {
            var doc = iframe.contentDocument;

            strictEqual(doc.querySelector('h1').textContent, 'Header');
            ok(/Text( text){19}/.test(doc.querySelector('p').innerHTML));
            strictEqual(nativeMethods.anchorTargetGetter.call(doc.querySelector('a')), '_top');
            strictEqual(doc.querySelectorAll('body > table tr > td > a > img').length, 1);
        });
});

test('script error when adding a comment node to DOM (GH-435)', function () {
    var commentNode = document.createComment('');

    document.documentElement.appendChild(commentNode);
    strictEqual(commentNode, document.documentElement.lastChild);

    commentNode.parentNode.removeChild(commentNode);
    ok(!commentNode.parentNode);

    var textNode1 = document.createTextNode('');

    document.documentElement.appendChild(textNode1);
    strictEqual(textNode1, document.documentElement.lastChild);

    textNode1.parentNode.removeChild(textNode1);
    ok(!textNode1.parentNode);

    var documentFragment = document.createDocumentFragment();
    var textNode2        = document.createTextNode('');

    documentFragment.appendChild(textNode2);
    document.documentElement.appendChild(documentFragment);
    strictEqual(textNode2, document.documentElement.lastChild);
    textNode2.parentNode.removeChild(textNode2);
});

test('"permission denied" error inside documentWriter (GH-384)', function () {
    return createTestIframe({ src: getSameDomainPageUrl('../../../data/dom-processor/iframe.html') })
        .then(function (iframe) {
            var iframeDocument = iframe.contentDocument;

            iframeDocument.write('<h1 id="testElement">test</h1>');
            ok(nativeMethods.getElementById.call(iframeDocument, 'testElement'));
        });
});

test('document.write for same-domain iframe (GH-679)', function () {
    return createTestIframe({ src: getSameDomainPageUrl('../../../data/code-instrumentation/iframe.html') })
        .then(function (iframe) {
            iframe.contentDocument.open();
            iframe.contentDocument.write('<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.0 Transitional//EN"><title></title><span></span><script type="text/javascript"><' + '/script>');
            iframe.contentDocument.close();

            strictEqual(iframe.contentDocument.childNodes.length, 2);

            iframe.contentDocument.open();
            iframe.contentDocument.write('<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.0 Transitional//EN"><title></title><span></span><script type="text/javascript"><' + '/script>');
            iframe.contentDocument.close();

            strictEqual(iframe.contentDocument.childNodes.length, 2);
        });
});

test('an iframe should not contain self-removing scripts after document.close (GH-871)', function () {
    return createTestIframe()
        .then(function (iframe) {
            var iframeDocument = iframe.contentDocument;

            iframeDocument.designMode = 'On';
            iframeDocument.open();
            iframeDocument.write('<body style="padding: 0; margin: 0; overflow: hidden;"></body>');
            iframeDocument.close();

            var selfRemovingScripts = nativeMethods.querySelectorAll.call(iframeDocument,
                '.' + SHADOW_UI_CLASSNAME.selfRemovingScript);

            strictEqual(selfRemovingScripts.length, 0);
        });
});

test('an iframe should not contain injected scripts after loading (GH-2622)', function () {
    // NOTE: here we use an iframe with an empty sandbox attribute because we lift some restrictions
    // (allow-same-origin allow-scripts) in our internal iframe processing logic
    return createTestIframe({
        src:     getSameDomainPageUrl('../../../data/iframe/simple-iframe.html'),
        sandbox: '',
    })
        .then(function (iframe) {
            var iframeInjectedScripts = nativeMethods.querySelectorAll.call(iframe.contentDocument, '.' + SHADOW_UI_CLASSNAME.script);

            strictEqual(iframeInjectedScripts.length, 0);
        });
});

test('should not throw an error when document.defaultView is null (GH-1272)', function () {
    return new Promise(function (resolve, reject) {
        var iframe         = document.createElement('iframe');
        var loadEventCount = 0;

        iframe.id     = 'test' + Date.now();
        iframe.src    = 'javascript:"";';
        iframe.onload = function () {
            var doc = iframe.contentDocument;

            // NOTE: Without wrapping in 'setTimeout' function the error is not reproduced
            setTimeout(function () {
                try {
                    // NOTE: Chrome throw an error after second load
                    if (loadEventCount++ < 2) {
                        doc.open();
                        doc.write('<div>' + loadEventCount + '</div>');
                        doc.close();
                    }
                    else
                        resolve(iframe);
                }
                catch (e) {
                    reject(e);
                }
            }, 100);
        };

        document.body.appendChild(iframe);
    })
        .then(function (iframe) {
            strictEqual(iframe.contentDocument.documentElement.innerText, '2');
            document.body.removeChild(iframe);
        });
});

test('querySelector should return an element if a selector contains the href attribute with hash as a value (GH-922)', function () {
    var testDiv = document.createElement('div');

    nativeMethods.elementInnerHTMLSetter.call(testDiv, '<a href="  #/"> Hash link </a>');
    document.body.appendChild(testDiv);

    ok(testDiv['hammerhead|element-processed']);

    var element = document.querySelector('[href="  #/"]');

    ok(element);

    document.body.removeChild(testDiv);
});

if (document.registerElement) {
    test('should not raise an error if processed element is created via non-overriden way and it is locked (GH-1300)', function () {
        var CustomElementConstructor = document.registerElement('custom-element', {
            prototype: {
                __proto__: HTMLElement.prototype,
            },
        });
        var customElement1           = new CustomElementConstructor();
        var customElement2           = new CustomElementConstructor();
        var customElement3           = new CustomElementConstructor();

        try {
            Object.preventExtensions(customElement1);
            document.body.appendChild(customElement1);
            ok(true, 'Object.preventExtensions');
        }
        catch (e) {
            ok(false, 'Object.preventExtensions');
        }

        try {
            Object.seal(customElement2);
            document.body.appendChild(customElement2);
            ok(true, 'Object.seal');
        }
        catch (e) {
            ok(false, 'Object.seal');
        }

        try {
            Object.freeze(customElement3);
            document.body.appendChild(customElement3);
            ok(true, 'Object.freeze');
        }

        catch (e) {
            ok(false, 'Object.freeze');
        }

        [customElement1, customElement2, customElement3].forEach(function (element) {
            if (element.parentNode)
                element.parentNode.removeChild(element);
        });
    });
}

test('should reprocess element if it is created in iframe window and it is not frozen (GH-1300)', function () {
    return createTestIframe({ src: getSameDomainPageUrl('../../../data/iframe/simple-iframe.html') })
        .then(function (iframe) {
            var iframeLink = iframe.contentDocument.createElement('a');

            Object.preventExtensions(iframeLink);
            document.body.appendChild(iframeLink);
            strictEqual(iframeLink[INTERNAL_PROPS.processedContext], window);

            iframeLink = iframe.contentDocument.createElement('a');
            Object.seal(iframeLink);
            document.body.appendChild(iframeLink);
            strictEqual(iframeLink[INTERNAL_PROPS.processedContext], window);

            iframeLink = iframe.contentDocument.createElement('a');
            Object.freeze(iframeLink);
            document.body.appendChild(iframeLink);
            strictEqual(iframeLink[INTERNAL_PROPS.processedContext], iframe.contentWindow);
        });
});

test('should not throw an error if the `children` property is overridden by client (GH-2287)', function () {
    expect(0);

    Object.defineProperty(Element.prototype, 'children', {
        get: function () {
            throw new Error();
        },
    });

    var div = document.createElement('div');

    div.innerHTML = '<span></span>';
});
