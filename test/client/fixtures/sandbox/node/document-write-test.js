var processScript = hammerhead.get('../processing/script').processScript;
var urlUtils      = hammerhead.get('./utils/url');

var nativeMethods = hammerhead.nativeMethods;
var iframeSandbox = hammerhead.sandbox.iframe;
var nodeSandbox   = hammerhead.sandbox.node;

iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT_EVENT, initIframeTestHandler);
iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, iframeSandbox.iframeReadyToInitHandler);

var processedIframeForWrite;
var nativeIframeForWrite;
var storedProcessElement = nodeSandbox._processElement;

nodeSandbox._processElement = function (el) {
    if (el !== nativeIframeForWrite)
        storedProcessElement.call(nodeSandbox, el);
};

QUnit.testDone(function () {
    nativeMethods.removeChild.call(document.body, nativeIframeForWrite);
});

function createWriteTestIframes () {
    return new hammerhead.Promise(function (resolve) {
        nativeIframeForWrite = nativeMethods.createElement.call(document, 'iframe');

        nativeMethods.addEventListener.call(nativeIframeForWrite, 'load', resolve);
        nativeMethods.appendChild.call(document.body, nativeIframeForWrite);
    })
        .then(createTestIframe)
        .then(function (iframe) {
            processedIframeForWrite = iframe;
        });
}

function open () {
    processedIframeForWrite.contentDocument.open();
    nativeMethods.documentOpen.call(nativeIframeForWrite.contentDocument);
}

function close () {
    processedIframeForWrite.contentDocument.close();
    nativeMethods.documentClose.call(nativeIframeForWrite.contentDocument);
}

function testHTML () {
    strictEqual(eval(processScript('processedIframeForWrite.contentDocument.documentElement.innerHTML')),
        nativeIframeForWrite.contentDocument.documentElement.innerHTML);
    strictEqual(eval(processScript('processedIframeForWrite.contentDocument.documentElement.outerHTML')),
        nativeIframeForWrite.contentDocument.documentElement.outerHTML);
}

function testContent (selector) {
    var elsFromNativeIframe = nativeIframeForWrite.contentDocument.querySelectorAll(selector);
    var elsFromIframe       = processedIframeForWrite.contentDocument.querySelectorAll(selector);

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
    strictEqual(eval(processScript('processedIframeForWrite.contentWindow[variableName]')),
        nativeIframeForWrite.contentWindow[variableName]);
}

function testWrite () {
    processedIframeForWrite.contentDocument.write.apply(processedIframeForWrite.contentDocument, arguments);
    nativeMethods.documentWrite.apply(nativeIframeForWrite.contentDocument, arguments);

    testHTML();
}

function testWriteln () {
    processedIframeForWrite.contentDocument.writeln.apply(processedIframeForWrite.contentDocument, arguments);
    nativeMethods.documentWriteLn.apply(nativeIframeForWrite.contentDocument, arguments);

    testHTML();
}

test('write incomplete tags', function () {
    return createWriteTestIframes()
        .then(function () {
            open();
            testWrite('<div id="div1"></div>');
            testWrite('<div id="div2">');
            testWrite('</div>');
            testWrite('<div id="div3"');
            testWrite('>');
            testWrite('content');
            testWrite('\nother content');
            testWrite('</div>');
            testWriteln('content');
            close();
        });
});

test('write script', function () {
    return createWriteTestIframes()
        .then(function () {
            open();
            testWrite('<script>var a, b, c;<' + 'script>');
            testWrite('<script id="scr1">');
            testContent('#scr1');
            testWrite('var a = 5;');
            testContent('#scr1');
            testVariable('a');
            testWrite('var b = 6;');
            testContent('#scr1');
            testVariable('b');
            testWrite('<' + '/script>');
            testContent('#scr1');
            testVariable('a');
            testVariable('b');
            testWrite('var c = x + y;');
            testWrite('<script id="scr2">var c=a<b;');
            testContent('#scr2');
            testVariable('c');
            testWrite('<' + '/script>');
            testContent('#scr2');
            testVariable('c');
            close();
        });
});

test('write style', function () {
    return createWriteTestIframes()
        .then(function () {
            open();
            testWriteln('<style id="stl1">');
            testContent('#stl1');
            testWriteln('div {}');
            testContent('#stl1');
            testWriteln('</style><style id="stl2">body {background-image: url(https://example.com/image.png);}');
            testContent('#stl1, #stl2');
            testWriteln('li {display:block;}</style><div></div>');
            testContent('#stl2');
            close();
        });
});

test('document.write, document.writeln with multiple parameters', function () {
    return createWriteTestIframes()
        .then(function () {
            open();
            testWrite('w1', 'w2', 'w3');
            testWriteln('wl1', 'wl2', 'wl3');
            testWriteln('wl4');
            testWriteln();
            testWrite();
            close();
        });
});

test('write html comment', function () {
    return createWriteTestIframes()
        .then(function () {
            open();
            testWrite('<div id="main"><!--');
            testWriteln('<div id="nonexistent">bla');
            testWriteln('this is comment');
            testWrite('-->');
            testWrite('<a href="/link"></a>');
            testWrite('</div>');
            close();
        });
});

test('write textarea', function () {
    return createWriteTestIframes()
        .then(function () {
            open();
            testWrite('<textarea>');
            testWriteln('test');
            testWriteln('other text');
            testWrite('</textarea>');
            close();
        });
});

test('DocumentWriter should be recreated after document cleaning', function () {
    return createWriteTestIframes()
        .then(function () {
            open();
            testWrite('<textarea>');
            close();
            open();
            testWrite('<textarea></textarea><textarea>');
            close();
            testWrite('<textarea></textarea>');
            close();
        });
});

module('regression');

test('write closing tag by parts (GH-1311)', function () {
    return createWriteTestIframes()
        .then(function () {
            open();
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
            testWrite('<script><' + '/script  ');
            testWrite('>');
            testWrite('<div></d');
            testWrite('iv>');
            testWrite('<');
            testWrite('style></st');
            testWrite('yl');
            testWrite('e>');
            testWrite('<script></scriptxyz');
            testWrite('>');
            testWrite('<' + '/script>');
            testWrite('<script></script');
            testWrite('xyz>');
            testWrite('<' + '/script>');
            testWrite('<script></sript');
            testWrite('>');
            testWrite('<' + '/script>');
            close();
        });
});

test('write script with src and without closing tag (GH-1218)', function () {
    return createWriteTestIframes()
        .then(function () {
            open();
            testWrite('<script id="script" src="script.js">');

            var script       = processedIframeForWrite.contentDocument.querySelector('#script');
            var resourceType = urlUtils.stringifyResourceType({ isScript: true });

            strictEqual(script.src, urlUtils.getProxyUrl('script.js', { resourceType: resourceType }));

            testWrite('var x = 5;');
            testWrite('<' + '/script>');
            close();
        });
});
