var SHADOW_UI_CLASSNAME = hammerhead.get('./../shadow-ui/class-name');
var ShadowUI            = hammerhead.get('./sandbox/shadow-ui');
var settings            = hammerhead.get('./settings');

var shadowUI      = hammerhead.sandbox.shadowUI;
var iframeSandbox = hammerhead.sandbox.iframe;
var domUtils      = hammerhead.utils.dom;
var positionUtils = hammerhead.utils.position;
var nativeMethods = hammerhead.nativeMethods;

var TEST_DIV_SELECTOR   = '#testDiv';
var TEST_CLASS_NAME     = 'test-class';
var TEST_CLASS_SELECTOR = '.test-class';

QUnit.testStart(function () {
    if (!$(TEST_DIV_SELECTOR).length)
        $('<div id="testDiv">').appendTo('body');

    $(TEST_DIV_SELECTOR).empty();
    $(shadowUI.getRoot()).empty();
    $(TEST_CLASS_SELECTOR).remove();
    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
});

test('add UI class and get UI element with selector', function () {
    var uiElem = document.createElement('div');

    uiElem.id = 'uiElem';
    document.body.appendChild(uiElem);

    shadowUI.addClass(uiElem, 'ui-elem-class');
    $(TEST_DIV_SELECTOR).append(uiElem);
    uiElem = shadowUI.select('div.ui-elem-class')[0];

    strictEqual(uiElem.id, 'uiElem');

    uiElem.parentNode.removeChild(uiElem);
});

if (window.MutationObserver) {
    asyncTest('shadow MutationObserver', function () {
        var uiEl         = document.createElement('div');
        var el           = document.createElement('div');
        var shadowUIRoot = shadowUI.getRoot();

        shadowUI.addClass(uiEl, 'ui-elem-class');

        var observer = new window.MutationObserver(function (mutations) {
            strictEqual(mutations.length, 1);
            strictEqual(mutations[0].addedNodes[0], el);
            observer.disconnect();
            uiEl.parentNode.removeChild(uiEl);
            el.parentNode.removeChild(el);

            start();
        });

        observer.observe(document.body, { childList: true });

        shadowUIRoot.appendChild(uiEl);
        document.body.appendChild(el);
    });
}

test('get root', function () {
    var root = shadowUI.getRoot();

    root.id = 'uiRoot';
    strictEqual(shadowUI.select('#uiRoot').length, 1);

    root.parentNode.removeChild(root);
});

asyncTest('get root after body recreation', function () {
    var iframe = document.createElement('iframe');

    iframe.id = 'test_unique_lsjisujf';
    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            var document = iframe.contentDocument;
            var window   = iframe.contentWindow;
            var getRoot  = function () {
                return window['%hammerhead%'].shadowUI.getRoot();
            };

            ok(getRoot());

            var html = document.documentElement;

            html.removeChild(document.body);
            html.appendChild(document.createElement('body'));
            ok(getRoot());

            html.removeChild(document.body);
            html.insertBefore(document.createElement('body'), null);
            ok(getRoot());

            iframe.parentNode.removeChild(iframe);
            start();
        });
    document.body.appendChild(iframe);
});

module('childNodes');

test('body.childNodes', function () {
    var root             = shadowUI.getRoot();
    var found            = false;
    var childNodes       = document.body.childNodes;
    var childNodesLength = eval(processScript('childNodes.length'));

    strictEqual(childNodesLength, childNodes.length - 1);

    for (var i = 0; i < childNodesLength; i++) {
        if (childNodes[i] === root)
            found = true;
    }

    ok(!found);
});

test('body.children', function () {
    var root           = shadowUI.getRoot();
    var found          = false;
    var children       = document.body.children;
    var childrenLength = eval(processScript('children.length'));

    strictEqual(childrenLength, children.length - 1);

    for (var i = 0; i < childrenLength; i++) {
        if (children[i] === root)
            found = true;
    }

    ok(!found);
});

test('head.children', function () {
    var shadowUIElementsCount = 0;

    for (var i = 0; i < document.head.children.length; i++)
        shadowUIElementsCount += domUtils.isShadowUIElement(document.head.children[i]) ? 1 : 0;

    var found = false;
    var link1 = document.createElement('link');

    link1.rel  = 'stylesheet';
    link1.href = '/test.css';
    link1.type = 'text/css';

    shadowUI.addClass(link1, 'ui-stylesheet');
    document.head.insertBefore(link1, document.head.firstChild);

    var link2 = document.createElement('link');

    link2.rel  = 'stylesheet';
    link2.href = '/test.css';
    link2.type = 'text/css';

    shadowUI.addClass(link2, 'ui-stylesheet');
    document.head.insertBefore(link2, document.head.firstChild);

    var children       = document.head.children;
    var childrenLength = eval(processScript('children.length'));

    strictEqual(childrenLength, children.length - 2 - shadowUIElementsCount);

    for (var j = 0; j < childrenLength; j++) {
        if (children[j] === link1 || children[j] === link2)
            found = true;
    }

    link1.parentNode.removeChild(link1);
    link2.parentNode.removeChild(link2);

    ok(!found, 'check that document.head.children does not return Hammerhead elements');
});

test('head.childNodes', function () {
    var shadowUIElementsCount = 0;

    for (var i = 0; i < document.head.childNodes.length; i++)
        shadowUIElementsCount += domUtils.isShadowUIElement(document.head.childNodes[i]) ? 1 : 0;

    var found = false;
    var link1 = document.createElement('link');

    link1.rel  = 'stylesheet';
    link1.href = '/test.css';
    link1.type = 'text/css';

    shadowUI.addClass(link1, 'ui-stylesheet');
    document.head.insertBefore(link1, document.head.firstChild);

    var link2 = document.createElement('link');

    link2.rel  = 'stylesheet';
    link2.href = '/test.css';
    link2.type = 'text/css';

    shadowUI.addClass(link2, 'ui-stylesheet');
    document.head.insertBefore(link2, document.head.firstChild);

    var childNodes       = document.head.childNodes;
    var childNodesLength = eval(processScript('childNodes.length'));

    strictEqual(childNodesLength, childNodes.length - 2 - shadowUIElementsCount);

    for (var j = 0; j < childNodesLength; j++) {
        if (childNodes[j] === link1 || childNodes[j] === link2)
            found = true;
    }

    link1.parentNode.removeChild(link1);
    link2.parentNode.removeChild(link2);

    ok(!found, 'check that document.head.childNodes does not return Hammerhead elements');
});

test('isShadowContainerCollection', function () {
    var el         = document.body.insertBefore(document.createElement('div'), document.body.firstChild);
    var collection = document.querySelectorAll('body *');

    strictEqual(collection[0], el);
    ok(!ShadowUI.isShadowContainerCollection(collection));
});

test('HTMLCollection.item, HTMLCollection.namedItem methods emulation', function () {
    var input = document.createElement('input');

    input.name = 'testInput';
    document.body.appendChild(input);

    var children        = nativeMethods.elementGetElementsByTagName.call(document.body, '*');
    var wrappedChildren = document.body.getElementsByTagName('*');

    strictEqual(wrappedChildren.length, children.length - 1);
    strictEqual(wrappedChildren.item(0), children[0]);
    ok(!wrappedChildren.item(-1));
    ok(!wrappedChildren.item(10000));

    // NOTE: Safari returns NodeList instead of HTMLCollection.
    if (wrappedChildren.namedItem)
        strictEqual(wrappedChildren.namedItem('testInput'), input);

    input.parentNode.removeChild(input);
});

test('Node.nextSibling, NonDocumentTypeChildNode.nextElementSibling', function () {
    var bodyChildCount = document.body.childNodes.length;
    var root           = document.body.childNodes[bodyChildCount - 1];
    var previous       = document.body.childNodes[bodyChildCount - 2];

    ok(domUtils.isShadowUIElement(root));
    ok(!domUtils.isShadowUIElement(previous));

    strictEqual(previous.nextSibling, root);
    strictEqual(getProperty(previous, 'nextSibling'), null);

    strictEqual(previous.nextElementSibling, root);
    strictEqual(getProperty(previous, 'nextElementSibling'), null);
});

module('element methods');

test('Node.childElementCount', function () {
    var bodyChildCount = document.body.children.length;

    strictEqual(getProperty(document.body, 'childElementCount'), bodyChildCount - 1);
});

test('body.getElementsByClassName', function () {
    var root   = shadowUI.getRoot();
    var uiElem = document.createElement('div');

    uiElem.id        = 'uiChild';
    uiElem.className = TEST_CLASS_NAME;
    root.appendChild(uiElem);

    var pageElem = document.createElement('div');

    pageElem.id        = 'pageElem';
    pageElem.className = TEST_CLASS_NAME;
    document.body.appendChild(pageElem);

    var elems = document.body.getElementsByClassName(TEST_CLASS_NAME);

    strictEqual(elems.length, 1);
    strictEqual(elems[0].id, 'pageElem');
});

test('body.getElementsByTagName', function () {
    var root   = shadowUI.getRoot();
    var uiElem = document.createElement('textarea');

    uiElem.id        = 'uiChild';
    uiElem.className = TEST_CLASS_NAME;
    root.appendChild(uiElem);

    var pageElem = document.createElement('textarea');

    pageElem.id        = 'pageElem';
    pageElem.className = TEST_CLASS_NAME;
    document.body.appendChild(pageElem);

    var elems = document.body.getElementsByTagName('TEXTAREA');

    strictEqual(elems.length, 1);
    strictEqual(elems[0].id, 'pageElem');
});

test('head.getElementsByTagName', function () {
    var found = false;
    var link  = document.createElement('link');

    link.rel  = 'stylesheet';
    link.href = '/test.css';
    link.type = 'text/css';

    shadowUI.addClass(link, 'ui-stylesheet');
    document.head.appendChild(link);

    var children = document.head.getElementsByTagName('link');

    for (var i = 0; i < children.length; i++) {
        if (children[i] === link)
            found = true;
    }

    link.parentNode.removeChild(link);
    ok(!found, 'check that document.head.getElementsByTagName does not return Hammerhead elements');
});

test('body.querySelector', function () {
    var root   = shadowUI.getRoot();
    var uiElem = document.createElement('div');

    uiElem.id        = 'uiChild';
    uiElem.className = TEST_CLASS_NAME + ' cli';
    root.appendChild(uiElem);

    var pageElem = document.createElement('div');

    pageElem.id        = 'pageElem';
    pageElem.className = TEST_CLASS_NAME + ' cli2';
    document.body.appendChild(pageElem);

    uiElem   = document.body.querySelector('.cl1');
    pageElem = document.body.querySelector('.cli2');

    ok(!uiElem);
    strictEqual(pageElem.id, 'pageElem');
});

test('body.querySelectorAll', function () {
    var root   = shadowUI.getRoot();
    var uiElem = document.createElement('div');

    uiElem.id        = 'uiChild';
    uiElem.className = TEST_CLASS_NAME + ' cli';
    root.appendChild(uiElem);

    var pageElem = document.createElement('div');

    pageElem.id        = 'pageElem';
    pageElem.className = TEST_CLASS_NAME + ' cli2';
    document.body.appendChild(pageElem);

    var elems = document.body.querySelectorAll(TEST_CLASS_SELECTOR);

    strictEqual(elems.length, 1);
    strictEqual(elems[0].id, 'pageElem');
});

module('document methods');

test('elementFromPoint', function () {
    var testDiv   = document.querySelector(TEST_DIV_SELECTOR);
    var simpleDiv = document.createElement('div');
    var shadowDiv = document.createElement('div');

    simpleDiv.style.height = '10px';
    shadowDiv.style.height = '10px';

    shadowUI.addClass(shadowDiv, 'root');

    testDiv.appendChild(simpleDiv);
    testDiv.appendChild(shadowDiv);

    var simpleDivPos = positionUtils.getOffsetPosition(simpleDiv);
    var shadowDivPos = positionUtils.getOffsetPosition(shadowDiv);

    strictEqual(document.elementFromPoint(simpleDivPos.left + 1, simpleDivPos.top + 1), simpleDiv);
    strictEqual(document.elementFromPoint(shadowDivPos.left + 1, shadowDivPos.top + 1), null);
});

if (document.caretPositionFromPoint) {
    test('caretPositionFromPoint', function () {
        var testDiv   = document.querySelector(TEST_DIV_SELECTOR);
        var simpleDiv = document.createElement('div');
        var shadowDiv = document.createElement('div');

        simpleDiv.style.height = '10px';
        shadowDiv.style.height = '10px';

        shadowUI.addClass(shadowDiv, 'root');

        testDiv.appendChild(simpleDiv);
        testDiv.appendChild(shadowDiv);

        var simpleDivPos = positionUtils.getOffsetPosition(simpleDiv);
        var shadowDivPos = positionUtils.getOffsetPosition(shadowDiv);

        var caretPosition         = document.caretPositionFromPoint(simpleDivPos.left + 1, simpleDivPos.top + 1);
        var shadowUICaretPosition = document.caretPositionFromPoint(shadowDivPos.left + 1, shadowDivPos.top + 1);

        strictEqual(caretPosition.offsetNode, simpleDiv);
        strictEqual(caretPosition.offset, 0);
        strictEqual(shadowUICaretPosition, null);
    });
}

if (document.caretRangeFromPoint) {
    test('caretRangeFromPoint', function () {
        var testDiv   = document.querySelector(TEST_DIV_SELECTOR);
        var simpleDiv = document.createElement('div');
        var shadowDiv = document.createElement('div');

        simpleDiv.style.height    = '20px';
        simpleDiv.contentEditable = true;
        shadowDiv.style.height    = '20px';
        shadowDiv.contentEditable = true;

        shadowUI.addClass(shadowDiv, 'root');

        testDiv.appendChild(simpleDiv);
        testDiv.appendChild(shadowDiv);

        var simpleDivPos = positionUtils.getOffsetPosition(simpleDiv);
        var shadowDivPos = positionUtils.getOffsetPosition(shadowDiv);

        var caretRange         = document.caretRangeFromPoint(simpleDivPos.left + 1, simpleDivPos.top + 1);
        var shadowUICaretRange = document.caretRangeFromPoint(shadowDivPos.left + 1, shadowDivPos.top + 1);

        strictEqual(caretRange.startContainer, simpleDiv);
        strictEqual(caretRange.endContainer, simpleDiv);
        strictEqual(caretRange.startOffset, 0);
        strictEqual(shadowUICaretRange, null);
    });
}

test('getElementById', function () {
    var testDiv  = document.querySelector(TEST_DIV_SELECTOR);
    var uiRoot   = shadowUI.getRoot();
    var uiChild  = document.createElement('div');
    var pageElem = document.createElement('div');

    uiChild.id         = 'uiChild';
    uiChild.className  = TEST_CLASS_NAME;
    pageElem.id        = 'pageElem';
    pageElem.className = TEST_CLASS_NAME;

    uiRoot.appendChild(uiChild);
    testDiv.appendChild(pageElem);

    uiChild  = document.getElementById('uiChild');
    pageElem = document.getElementById('pageElem');

    ok(!uiChild);
    strictEqual(pageElem.id, 'pageElem');
});

test('getElementsByName', function () {
    var testDiv  = document.querySelector(TEST_DIV_SELECTOR);
    var uiRoot   = shadowUI.getRoot();
    var uiChild  = document.createElement('a');
    var pageElem = document.createElement('a');

    uiChild.id         = 'uiChild';
    uiChild.className  = TEST_CLASS_NAME;
    uiChild.name       = 'test-name';
    pageElem.id        = 'pageElem';
    pageElem.className = TEST_CLASS_NAME;
    pageElem.name      = 'test-name';

    uiRoot.appendChild(uiChild);
    testDiv.appendChild(pageElem);

    var elems = document.getElementsByName('test-name');

    strictEqual(elems.length, 1);
    strictEqual(elems[0].id, 'pageElem');
});

test('getElementsByTagName', function () {
    var testDiv  = document.querySelector(TEST_DIV_SELECTOR);
    var uiRoot   = shadowUI.getRoot();
    var uiChild  = document.createElement('div');
    var pageElem = document.createElement('div');

    uiChild.id         = 'uiChild';
    uiChild.className  = TEST_CLASS_NAME;
    pageElem.id        = 'pageElem';
    pageElem.className = TEST_CLASS_NAME;

    uiRoot.appendChild(uiChild);
    testDiv.appendChild(pageElem);

    var elems = document.getElementsByTagName('DIV');

    for (var i = 0; i < elems.length; i++)
        notEqual(elems[i].id, 'uiChild');
});

test('getElementsByClassName', function () {
    var testDiv  = document.querySelector(TEST_DIV_SELECTOR);
    var uiRoot   = shadowUI.getRoot();
    var uiChild  = document.createElement('div');
    var pageElem = document.createElement('div');

    uiChild.id         = 'uiChild';
    uiChild.className  = TEST_CLASS_NAME;
    pageElem.id        = 'pageElem';
    pageElem.className = TEST_CLASS_NAME;

    uiRoot.appendChild(uiChild);
    testDiv.appendChild(pageElem);

    var elems = document.getElementsByClassName(TEST_CLASS_NAME);

    strictEqual(elems.length, 1);
    strictEqual(elems[0].id, 'pageElem');
});

test('querySelector', function () {
    var testDiv  = document.querySelector(TEST_DIV_SELECTOR);
    var uiRoot   = shadowUI.getRoot();
    var uiChild  = document.createElement('div');
    var pageElem = document.createElement('div');

    uiChild.id         = 'uiChild';
    uiChild.className  = TEST_CLASS_NAME + ' ui-child-class';
    pageElem.id        = 'pageElem';
    pageElem.className = TEST_CLASS_NAME + ' page-element-class';

    uiRoot.appendChild(uiChild);
    testDiv.appendChild(pageElem);

    uiChild  = document.querySelector('.ui-child-class');
    pageElem = document.querySelector('.page-element-class');

    ok(!uiChild);
    strictEqual(pageElem.id, 'pageElem');
});

test('querySelectorAll', function () {
    var testDiv  = document.querySelector(TEST_DIV_SELECTOR);
    var uiRoot   = shadowUI.getRoot();
    var uiChild  = document.createElement('div');
    var pageElem = document.createElement('div');

    uiChild.id         = 'uiChild';
    uiChild.className  = TEST_CLASS_NAME;
    pageElem.id        = 'pageElem';
    pageElem.className = TEST_CLASS_NAME;

    uiRoot.appendChild(uiChild);
    testDiv.appendChild(pageElem);

    var elems = document.querySelectorAll(TEST_CLASS_SELECTOR);

    strictEqual(elems.length, 1);
    strictEqual(elems[0].id, 'pageElem');
});

module('ui stylesheet');

asyncTest('stylesheets are restored after the document is cleaned', function () {
    var link1  = document.createElement('link');
    var link2  = document.createElement('link');
    var iframe = document.createElement('iframe');

    link1.className = SHADOW_UI_CLASSNAME.uiStylesheet;
    link2.className = SHADOW_UI_CLASSNAME.uiStylesheet;
    link1.id        = 'id1';
    link2.id        = 'id2';
    iframe.id       = 'test';

    document.head.insertBefore(link2, document.head.firstChild);
    document.head.insertBefore(link1, document.head.firstChild);

    window.QUnitGlobals.waitForIframe(iframe).then(function () {
        iframe.contentDocument.write('<html><body>Cleaned!</body></html>');

        var iframeUIStylesheets = nativeMethods.querySelectorAll.call(
            iframe.contentDocument,
            '.' + SHADOW_UI_CLASSNAME.uiStylesheet
        );
        var result              = '';

        for (var index = 0, length = iframeUIStylesheets.length; index < length; index++) {
            var iframeUIStylesheet = iframeUIStylesheets[index];

            domUtils.isShadowUIElement(iframeUIStylesheet);
            result += iframeUIStylesheet.id;
        }

        ok(iframe.contentDocument.body.innerHTML.indexOf('Cleaned!') > -1);
        strictEqual(length, 3);
        strictEqual(result, 'id1id2');

        document.head.removeChild(link1);
        document.head.removeChild(link2);
        document.body.removeChild(iframe);

        start();
    });
    document.body.appendChild(iframe);
});

asyncTest('append stylesheets to the iframe on initialization', function () {
    var link1  = document.createElement('link');
    var link2  = document.createElement('link');
    var iframe = document.createElement('iframe');

    link1.className = SHADOW_UI_CLASSNAME.uiStylesheet;
    link2.className = SHADOW_UI_CLASSNAME.uiStylesheet;
    link1.id        = 'id1';
    link2.id        = 'id2';
    iframe.id       = 'test';

    document.head.insertBefore(link2, document.head.firstChild);
    document.head.insertBefore(link1, document.head.firstChild);

    window.QUnitGlobals.waitForIframe(iframe).then(function () {
        var currentUIStylesheets = nativeMethods.querySelectorAll.call(
            document,
            '.' + SHADOW_UI_CLASSNAME.uiStylesheet
        );
        var iframeUIStylesheets  = nativeMethods.querySelectorAll.call(
            iframe.contentDocument,
            '.' + SHADOW_UI_CLASSNAME.uiStylesheet
        );

        strictEqual(currentUIStylesheets.length, iframeUIStylesheets.length);

        for (var i = 0; i < currentUIStylesheets.length; i++)
            strictEqual(currentUIStylesheets[i].outerHTML, iframeUIStylesheets[i].outerHTML);

        document.head.removeChild(link1);
        document.head.removeChild(link2);
        document.body.removeChild(iframe);

        start();
    });
    document.body.appendChild(iframe);
});

asyncTest("do nothing if ShadowUIStylesheet doesn't exist", function () {
    var iframe       = document.createElement('iframe');
    var qUnitCssLink = nativeMethods.querySelector.call(document, '.' + SHADOW_UI_CLASSNAME.uiStylesheet);

    iframe.id              = 'test';
    qUnitCssLink.className = '';

    window.QUnitGlobals.waitForIframe(iframe).then(function () {
        var currentUIStylesheets = nativeMethods.querySelectorAll.call(
            document,
            '.' + SHADOW_UI_CLASSNAME.uiStylesheet
        );
        var iframeUIStylesheets  = nativeMethods.querySelectorAll.call(
            iframe.contentDocument,
            '.' + SHADOW_UI_CLASSNAME.uiStylesheet
        );

        strictEqual(currentUIStylesheets.length, 0);
        strictEqual(iframeUIStylesheets.length, 0);

        qUnitCssLink.className = SHADOW_UI_CLASSNAME.uiStylesheet;
        iframe.parentNode.removeChild(iframe);

        start();
    });
    document.body.appendChild(iframe);
});

module('regression');

test('SVG elements\' className is of the SVGAnimatedString type instead of string (GH-354)', function () {
    setProperty(document.body, 'innerHTML', '<svg></svg>' + document.body.innerHTML);

    var svg                         = document.body.childNodes[0];
    var processedBodyChildrenLength = getProperty(document.body.children, 'length');

    strictEqual(processedBodyChildrenLength, document.body.children.length - 1);

    svg.parentNode.removeChild(svg);
});

asyncTest('after clean up iframe.body.innerHtml ShadowUI\'s root must exist (T225944)', function () {
    var iframe = document.createElement('iframe');

    iframe.id = 'test001';
    window.QUnitGlobals.waitForIframe(iframe).then(function () {
        var root = iframe.contentWindow['%hammerhead%'].shadowUI.getRoot();

        strictEqual(root.parentNode.parentNode.parentNode, iframe.contentDocument);

        iframe.contentDocument.body.innerHTMl = '';

        root = iframe.contentWindow['%hammerhead%'].shadowUI.getRoot();

        strictEqual(root.parentNode.parentNode.parentNode, iframe.contentDocument);

        iframe.parentNode.removeChild(iframe);
        start();
    });
    document.body.appendChild(iframe);
});

test('shadowUI\'s root must be the last child after adding a new element (T239689)', function () {
    var root              = shadowUI.getRoot();
    var bodyChildrenCount = document.body.children.length;

    strictEqual(document.body.children[bodyChildrenCount - 1], root);

    var div1 = document.createElement('div');

    div1.id = 'div1';
    document.body.appendChild(div1);
    strictEqual(document.body.children.length, bodyChildrenCount + 1);
    strictEqual(document.body.children[bodyChildrenCount - 1], div1);
    strictEqual(document.body.children[bodyChildrenCount], root);

    bodyChildrenCount = document.body.children.length;
    strictEqual(document.body.children[bodyChildrenCount - 1], root);

    var div2 = document.createElement('div');

    div2.id = 'div2';
    document.body.insertBefore(div2, null);
    strictEqual(document.body.children.length, bodyChildrenCount + 1);
    strictEqual(document.body.children[bodyChildrenCount - 1], div2);
    strictEqual(document.body.children[bodyChildrenCount], root);

    div1.parentNode.removeChild(div1);
    div2.parentNode.removeChild(div2);
});

asyncTest('isShadowContainerCollection for cross-domain iframe.contentWindow must return false (T212476)', function () {
    var storedCrossDomainPort = settings.get().crossDomainProxyPort;

    settings.get().crossDomainProxyPort = 2001;

    var crossDomainIframe = document.createElement('iframe');

    crossDomainIframe.src = window.getCrossDomainPageUrl('../../data/cross-domain/get-message.html');
    window.QUnitGlobals.waitForIframe(crossDomainIframe)
        .then(function () {
            ok(!ShadowUI.isShadowContainerCollection([crossDomainIframe.contentWindow]));

            crossDomainIframe.parentNode.removeChild(crossDomainIframe);
            settings.get().crossDomainProxyPort = storedCrossDomainPort;
            start();
        });
    document.body.appendChild(crossDomainIframe);
});

if (document.implementation && document.implementation.createHTMLDocument) {
    test('the getElementsByTagName function must return the body of htmlDoc (GH-741)', function () {
        var htmlDoc = document.implementation.createHTMLDocument('title');

        strictEqual(htmlDoc.getElementsByTagName('body')[0], nativeMethods.getElementsByTagName.call(htmlDoc, 'body')[0]);
    });
}

test('ShadowUI elements created via changing innerHTML should be recognized', function () {
    var root = shadowUI.getRoot();

    eval(processScript('root.innerHTML = "<div>\"'));

    ok(domUtils.isShadowUIElement(root.childNodes[0]));
});
