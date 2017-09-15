var processScript = hammerhead.get('../processing/script').processScript;
var urlUtils      = hammerhead.get('./utils/url');

var nativeMethods = hammerhead.nativeMethods;
var iframeSandbox = hammerhead.sandbox.iframe;
var nodeSandbox   = hammerhead.sandbox.node;

iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT_EVENT, initIframeTestHandler);
iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, iframeSandbox.iframeReadyToInitHandler);

var iframeForWrite       = document.createElement('iframe');
var iframeForNativeWrite = nativeMethods.createElement.call(document, 'iframe');
var storedProcessElement = nodeSandbox._processElement;

nodeSandbox._processElement = function (el) {
    if (el !== iframeForNativeWrite)
        storedProcessElement.call(nodeSandbox, el);
};

iframeForWrite.id       = 'test1';
iframeForNativeWrite.id = 'test2';

document.body.appendChild(iframeForWrite);
nativeMethods.appendChild.call(document.body, iframeForNativeWrite);

QUnit.testStart(open);
QUnit.testDone(close);

function open () {
    iframeForWrite.contentDocument.open();
    nativeMethods.documentOpen.call(iframeForNativeWrite.contentDocument);
}

function close () {
    iframeForWrite.contentDocument.close();
    nativeMethods.documentClose.call(iframeForNativeWrite.contentDocument);
}

function testHTML () {
    strictEqual(eval(processScript('iframeForWrite.contentDocument.documentElement.innerHTML')),
        iframeForNativeWrite.contentDocument.documentElement.innerHTML);
    strictEqual(eval(processScript('iframeForWrite.contentDocument.documentElement.outerHTML')),
        iframeForNativeWrite.contentDocument.documentElement.outerHTML);
}

function testContent (selector) {
    var elsFromNativeIframe = iframeForNativeWrite.contentDocument.querySelectorAll(selector);
    var elsFromIframe       = iframeForWrite.contentDocument.querySelectorAll(selector);

    if (elsFromIframe.length === elsFromNativeIframe.length) {
        for (var i = 0; i < elsFromIframe.length; i++) {
            /* eslint-disable no-unused-vars */
            var el = elsFromIframe[i];
            /* eslint-enable no-unused-vars */
            var nativeEl = elsFromNativeIframe[i];

            strictEqual(eval(processScript('el.innerHTML')), nativeEl.innerHTML);
            strictEqual(eval(processScript('el.innerText.trim()')), nativeEl.innerText.trim());
            strictEqual(eval(processScript('el.textContent')), nativeEl.textContent);
            strictEqual(eval(processScript('el.text')), nativeEl.text);
        }
    }
    else
        strictEqual(elsFromIframe.length, elsFromNativeIframe.length);
}

function testVariable (variableName) {
    strictEqual(eval(processScript('iframeForWrite.contentWindow[variableName]')),
        iframeForNativeWrite.contentWindow[variableName]);
}

function testWrite () {
    iframeForWrite.contentDocument.write.apply(iframeForWrite.contentDocument, arguments);
    nativeMethods.documentWrite.apply(iframeForNativeWrite.contentDocument, arguments);

    testHTML();
}

function testWriteln () {
    iframeForWrite.contentDocument.writeln.apply(iframeForWrite.contentDocument, arguments);
    nativeMethods.documentWriteLn.apply(iframeForNativeWrite.contentDocument, arguments);

    testHTML();
}

test('write incomplete tags', function () {
    testWrite('<div id="div1"></div>');
    testWrite('<div id="div2">');
    testWrite('</div>');
    testWrite('<div id="div3"');
    testWrite('>');
    testWrite('content');
    testWrite('\nother content');
    testWrite('</div>');
    testWriteln('content');
});

test('write script', function () {
    testWrite('<script>var a, b, c;<\/script>');
    testWrite('<script id="scr1">');
    testContent('#scr1');
    testWrite('var a = 5;');
    testContent('#scr1');
    testVariable('a');
    testWrite('var b = 6;');
    testContent('#scr1');
    testVariable('b');
    testWrite('<\/script>');
    testContent('#scr1');
    testVariable('a');
    testVariable('b');
    testWrite('var c = x + y;');
    testWrite('<script id="scr2">var c=a<b;');
    testContent('#scr2');
    testVariable('c');
    testWrite('<\/script>');
    testContent('#scr2');
    testVariable('c');
});

test('write style', function () {
    testWriteln('<style id="stl1">');
    testContent('#stl1');
    testWriteln('div {}');
    testContent('#stl1');
    testWriteln('</style><style id="stl2">body {background-image: url(https://example.com/image.png);}');
    testContent('#stl1, #stl2');
    testWriteln('li {display:block;}</style><div></div>');
    testContent('#stl2');
});

test('document.write, document.writeln with multiple parameters', function () {
    testWrite('w1', 'w2', 'w3');
    testWriteln('wl1', 'wl2', 'wl3');
    testWriteln('wl4');
    testWriteln();
    testWrite();
});

test('write html comment', function () {
    testWrite('<div id="main"><!--');
    testWriteln('<div id="nonexistent">bla');
    testWriteln('this is comment');
    testWrite('-->');
    testWrite('<a href="/link"></a>');
    testWrite('</div>');
});

test('write textarea', function () {
    testWrite('<textarea>');
    testWriteln('test');
    testWriteln('other text');
    testWrite('</textarea>');
});

module('regression');

test('write closing tag by parts (GH-1311)', function () {
    testWrite('<script></');
    testWrite('script>');
    testWrite('<script></s');
    testWrite('crIPt>');
    testWrite('<script></SC');
    testWrite('ript>');
    testWrite('<script></scR');
    testWrite('ipt>');
    testWrite('<script></scri');
    testWrite('pt>');
    testWrite('<script></scrip');
    testWrite('t>');
    testWrite('<script></script');
    testWrite('>');
    testWrite('<script></scriptxyz');
    testWrite('>');
    testWrite('<script></script');
    testWrite('xyz>');
    testWrite('<script></sript');
    testWrite('>');
    testWrite('<div></d');
    testWrite('iv>');
    testWrite('<');
    testWrite('style></st');
    testWrite('yl');
    testWrite('e>');
});

test('write script with src and without closing tag (GH-1218)', function () {
    testWrite('<script id="script" src="script.js">');

    var script       = iframeForWrite.contentDocument.querySelector('#script');
    var resourceType = urlUtils.stringifyResourceType({ isScript: true });

    strictEqual(script.src, urlUtils.getProxyUrl('script.js', { resourceType: resourceType }));

    testWrite('var x = 5;');
    testWrite('<\/script>');
});
