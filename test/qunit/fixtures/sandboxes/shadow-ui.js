var DOM           = Hammerhead.get('./util/dom');
var IFrameSandbox = Hammerhead.get('./sandboxes/iframe');
var NativeMethods = Hammerhead.get('./sandboxes/native-methods');
var Settings      = Hammerhead.get('./settings');
var ShadowUI      = Hammerhead.get('./sandboxes/shadow-ui');
var Const         = Hammerhead.get('../const');

QUnit.testStart = function () {
    if (!$('#testDiv').length)
        $('<div id="testDiv">').appendTo('body');

    $('#testDiv').empty();
    $(ShadowUI.getRoot()).empty();
    $('.test-class').remove();
    IFrameSandbox.on(IFrameSandbox.IFRAME_READY_TO_INIT, initIFrameTestHandler);
    IFrameSandbox.off(IFrameSandbox.IFRAME_READY_TO_INIT, IFrameSandbox.iframeReadyToInitHandler);
};

QUnit.testDone = function () {
    IFrameSandbox.off(IFrameSandbox.IFRAME_READY_TO_INIT, initIFrameTestHandler);
};

test('add UI class and get UI element with selector', function () {
    var uiElem = document.createElement('div');

    uiElem.id = 'uiElem';
    document.body.appendChild(uiElem);

    ShadowUI.addClass(uiElem, 'ui-elem-class');
    $('#testDiv').append(uiElem);
    uiElem    = ShadowUI.select('div.ui-elem-class')[0];

    strictEqual(uiElem.id, 'uiElem');

    uiElem.parentNode.removeChild(uiElem);
});

if (window.MutationObserver) {
    asyncTest('shadow MutationObserver', function () {
        var uiEl = document.createElement('div');
        var el   = NativeMethods.createElement.call(document, 'div');

        ShadowUI.addClass(uiEl, 'ui-elem-class');
        NativeMethods.insertBefore.call(document.body, uiEl, document.body.children[0]);

        var observer = new window.MutationObserver(function (mutations) {
            strictEqual(mutations.length, 1);
            strictEqual(mutations[0].addedNodes[0], el);
            observer.disconnect();
            uiEl.parentNode.removeChild(uiEl);
            el.parentNode.removeChild(el);
            start();
        });

        observer.observe(document.body, { childList: true });

        NativeMethods.appendChild.call(document.body, uiEl);
        NativeMethods.appendChild.call(document.body, el);
    });
}

test('get root', function () {
    var root = ShadowUI.getRoot();

    root.id = 'uiRoot';
    strictEqual(ShadowUI.select('#uiRoot').length, 1);

    root.parentNode.removeChild(root);
});

//T225944: 15.1 Testing - Recorder: JavaScriptExecutor can not be initialized (http://brumm.github.io/react-flexbox-playground/
asyncTest('iframe get root', function () {
    var $iframe = $('<iframe id="test001">');

    $iframe.load(function () {
        var $root = $(this.contentWindow.Hammerhead.ShadowUI.getRoot());

        strictEqual($root.parent().parent().parent()[0], this.contentDocument);

        this.contentDocument.body.innerHTMl = '';

        $root = $(this.contentWindow.Hammerhead.ShadowUI.getRoot());

        strictEqual($root.parent().parent().parent()[0], this.contentDocument);

        $iframe.remove();
        start();
    });

    $iframe.appendTo('body');
});

//T195358 - CSS selector is working too slow from jquery 1.9
test('getElementsByClassName, querySelectorAll should not override', function () {
    var doc             = {};
    var nativeMethRegEx = /^[^{]+\{\s*\[native \w/;

    ShadowUI.init(null, doc);

    ok(nativeMethRegEx.test(doc.getElementsByClassName));
    ok(nativeMethRegEx.test(doc.querySelectorAll));
});

module('childNodes');

test('body.childNodes', function () {
    var root             = ShadowUI.getRoot();
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
    var root           = ShadowUI.getRoot();
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

//T239689 - TD 15.1 - TestCafe recorder toolbar is not top most for images popup (http://moscow.auto.ru)
test('body.children - change collection', function () {
    var root              = ShadowUI.getRoot();
    var bodyChildrenCount = document.body.children.length;

    strictEqual(document.body.children[bodyChildrenCount - 1], root);

    var $newElement = $('<div>');

    document.body.appendChild($newElement[0]);

    strictEqual(document.body.children.length, bodyChildrenCount + 1);
    strictEqual(document.body.children[bodyChildrenCount - 1], $newElement[0]);
    strictEqual(document.body.children[bodyChildrenCount], root);

    $newElement.remove();
});

test('head.children', function () {
    var shadowUIElementsCount = 0;

    for (var i = 0; i < document.head.children.length; i++)
        shadowUIElementsCount += DOM.isShadowUIElement(document.head.children[i]) ? 1 : 0;

    var found = false;
    var link1 = document.createElement('link');

    link1.rel       = 'stylesheet';
    link1.href      = '/test.css';
    link1.type      = 'text/css';
    link1.className = Const.SHADOW_UI_STYLESHEET_FULL_CLASSNAME;
    document.head.insertBefore(link1, document.head.firstChild);

    var link2 = document.createElement('link');

    link2.rel       = 'stylesheet';
    link2.href      = '/test.css';
    link2.type      = 'text/css';
    link2.className = Const.SHADOW_UI_STYLESHEET_FULL_CLASSNAME;
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

    ok(!found, 'check that document.head.children does not return TestCafe elements');
});

test('head.childNodes', function () {
    var shadowUIElementsCount = 0;

    for (var i = 0; i < document.head.childNodes.length; i++)
        shadowUIElementsCount += DOM.isShadowUIElement(document.head.childNodes[i]) ? 1 : 0;

    var found = false;
    var link1 = document.createElement('link');

    link1.rel       = 'stylesheet';
    link1.href      = '/test.css';
    link1.type      = 'text/css';
    link1.className = Const.SHADOW_UI_STYLESHEET_FULL_CLASSNAME;
    document.head.insertBefore(link1, document.head.firstChild);

    var link2 = document.createElement('link');

    link2.rel       = 'stylesheet';
    link2.href      = '/test.css';
    link2.type      = 'text/css';
    link2.className = Const.SHADOW_UI_STYLESHEET_FULL_CLASSNAME;
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

    ok(!found, 'check that document.head.childNodes does not return TestCafe elements');
});

test('isShadowContainerCollection', function () {
    var el         = document.body.insertBefore(document.createElement('div'), document.body.firstChild);
    var collection = document.querySelectorAll('body *');

    strictEqual(collection[0], el);
    ok(!ShadowUI.isShadowContainerCollection(collection));
});

//T212476: Cross-domain error in Hammerhead when an array contains cross-domain iframes
asyncTest('isShadowContainerCollection for iframe contentWindow', function () {
    var storedCrossDomainPort = Settings.get().CROSS_DOMAIN_PROXY_PORT;

    Settings.get().CROSS_DOMAIN_PROXY_PORT = 1336;

    var crossDomainIframe = document.createElement('iframe');

    crossDomainIframe.src = window.getCrossDomainPageUrl('get-message.html');
    crossDomainIframe.addEventListener('load', function () {
        ok(!ShadowUI.isShadowContainerCollection([this.contentWindow]));

        crossDomainIframe.parentNode.removeChild(crossDomainIframe);
        Settings.get().CROSS_DOMAIN_PROXY_PORT = storedCrossDomainPort;
        start();
    });

    document.body.appendChild(crossDomainIframe);
});

test('HTMLCollection.item, HTMLCollection.namedItem methods emulation', function () {
    var input = document.createElement('input');

    input.name = 'testInput';
    document.body.appendChild(input);

    var children        = NativeMethods.elementGetElementsByTagName.call(document.body, '*');
    var wrappedChildren = document.body.getElementsByTagName('*');

    strictEqual(wrappedChildren.length, children.length - 1);
    strictEqual(wrappedChildren.item(0), children[0]);
    ok(!wrappedChildren.item(-1));
    ok(!wrappedChildren.item(10000));
    strictEqual(wrappedChildren.namedItem('testInput'), input);

    input.parentNode.removeChild(input);
});

module('element methods');

test('body.getElementsByClassName', function () {
    var root   = ShadowUI.getRoot();
    var uiElem = document.createElement('div');

    uiElem.id        = 'uiChild';
    uiElem.className = 'test-class';
    root.appendChild(uiElem);

    var pageElem = document.createElement('div');

    pageElem.id        = 'pageElem';
    pageElem.className = 'test-class';
    document.body.appendChild(pageElem);

    var elems = document.body.getElementsByClassName('test-class');

    strictEqual(elems.length, 1);
    strictEqual(elems[0].id, 'pageElem');
});

test('body.getElementsByTagName', function () {
    var root   = ShadowUI.getRoot();
    var uiElem = document.createElement('textarea');

    uiElem.id        = 'uiChild';
    uiElem.className = 'test-class';
    root.appendChild(uiElem);

    var pageElem = document.createElement('textarea');

    pageElem.id        = 'pageElem';
    pageElem.className = 'test-class';
    document.body.appendChild(pageElem);

    var elems = document.body.getElementsByTagName('TEXTAREA');

    strictEqual(elems.length, 1);
    strictEqual(elems[0].id, 'pageElem');
});

test('head.getElementsByTagName', function () {
    var found = false;
    var link  = document.createElement('link');

    link.rel       = 'stylesheet';
    link.href      = '/test.css';
    link.type      = 'text/css';
    link.className = Const.SHADOW_UI_STYLESHEET_FULL_CLASSNAME;
    document.head.appendChild(link);

    var children = document.head.getElementsByTagName('link');

    for (var i = 0; i < children.length; i++) {
        if (children[i] === link)
            found = true;
    }

    link.parentNode.removeChild(link);
    ok(!found, 'check that document.head.getElementsByTagName does not return TestCafe elements');
});

test('body.querySelector', function () {
    var root   = ShadowUI.getRoot();
    var uiElem = document.createElement('div');

    uiElem.id        = 'uiChild';
    uiElem.className = 'test-class cli';
    root.appendChild(uiElem);

    var pageElem = document.createElement('div');

    pageElem.id        = 'pageElem';
    pageElem.className = 'test-class cli2';
    document.body.appendChild(pageElem);

    uiElem   = document.body.querySelector('.cl1');
    pageElem = document.body.querySelector('.cli2');

    ok(!uiElem);
    strictEqual(pageElem.id, 'pageElem');
});

test('body.querySelectorAll', function () {
    var root   = ShadowUI.getRoot();
    var uiElem = document.createElement('div');

    uiElem.id        = 'uiChild';
    uiElem.className = 'test-class cli';
    root.appendChild(uiElem);

    var pageElem = document.createElement('div');

    pageElem.id        = 'pageElem';
    pageElem.className = 'test-class cli2';
    document.body.appendChild(pageElem);

    var elems = document.body.querySelectorAll('.test-class');

    strictEqual(elems.length, 1);
    strictEqual(elems[0].id, 'pageElem');
});

module('document methods');

test('getElementById', function () {
    var $testDiv = $('#testDiv');
    var $uiRoot  = $('<div>').appendTo($testDiv);

    $('<div>').attr('id', 'uiChild').appendTo($uiRoot);
    $('<div>').attr('id', 'pageElem').appendTo($testDiv);

    ShadowUI.addClass($uiRoot[0], 'root');

    var uiElem   = document.getElementById('uiChild');
    var pageElem = document.getElementById('pageElem');

    ok(!uiElem);
    strictEqual(pageElem.id, 'pageElem');
});

test('getElementsByName', function () {
    var $testDiv = $('#testDiv');
    var $uiRoot  = $('<div>').appendTo($testDiv);

    $('<input>').attr('id', 'uiChild').attr('name', 'test-name').appendTo($uiRoot);
    $('<input>').attr('id', 'pageElem').attr('name', 'test-name').appendTo($testDiv);

    ShadowUI.addClass($uiRoot[0], 'root');

    var elems = document.getElementsByName('test-name');

    strictEqual(elems.length, 1);
    strictEqual(elems[0].id, 'pageElem');
});

test('getElementsByTagName', function () {
    var $testDiv = $('#testDiv');
    var $uiRoot  = $('<div>').appendTo($testDiv);

    $('<div>').attr('id', 'uiChild').appendTo($uiRoot);
    $('<div>').attr('id', 'pageElem').appendTo($testDiv);

    ShadowUI.addClass($uiRoot[0], 'root');

    var elems = document.getElementsByTagName('DIV');

    $.each(elems, function () {
        notEqual(this.id, 'uiChild');
    });
});

test('getElementsByClassName', function () {
    var $testDiv = $('#testDiv');
    var $uiRoot  = $('<div>').appendTo($testDiv);

    $('<div>').attr('id', 'uiChild').addClass('test-class').appendTo($uiRoot);
    $('<div>').attr('id', 'pageElem').addClass('test-class').appendTo($testDiv);

    ShadowUI.addClass($uiRoot[0], 'root');

    var elems = document.getElementsByClassName('test-class');

    strictEqual(elems.length, 1);
    strictEqual(elems[0].id, 'pageElem');
});

test('querySelector', function () {
    var $testDiv = $('#testDiv');
    var $uiRoot  = $('<div>').appendTo($testDiv);

    $('<div>').attr('id', 'uiChild').addClass('ui-class').appendTo($uiRoot);
    $('<div>').attr('id', 'pageElem').addClass('page-class').appendTo($testDiv);

    ShadowUI.addClass($uiRoot[0], 'root');

    var uiElem   = document.querySelector('.ui-class');
    var pageElem = document.querySelector('.page-class');

    ok(!uiElem);
    strictEqual(pageElem.id, 'pageElem');
});

test('querySelectorAll', function () {
    var $testDiv = $('#testDiv');
    var $uiRoot  = $('<div>').appendTo($testDiv);

    $('<div>').attr('id', 'uiChild').addClass('test-class').appendTo($uiRoot);
    $('<div>').attr('id', 'pageElem').addClass('test-class').appendTo($testDiv);

    ShadowUI.addClass($uiRoot[0], 'root');

    var elems = document.querySelectorAll('.test-class');

    strictEqual(elems.length, 1);
    strictEqual(elems[0].id, 'pageElem');
});
