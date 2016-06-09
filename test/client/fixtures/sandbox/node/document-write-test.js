var processScript  = hammerhead.get('../processing/script').processScript;
var styleProcessor = hammerhead.get('../processing/style');
var urlUtils       = hammerhead.get('./utils/url');

var nativeMethods = hammerhead.nativeMethods;
var iframeSandbox = hammerhead.sandbox.iframe;
var nodeSandbox   = hammerhead.sandbox.node;

iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, iframeSandbox.iframeReadyToInitHandler);

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

function write () {
    iframeForWrite.contentDocument.write.apply(iframeForWrite.contentDocument, arguments);
    nativeMethods.documentWrite.apply(iframeForNativeWrite.contentDocument, arguments);
}

function writeln () {
    iframeForWrite.contentDocument.writeln.apply(iframeForWrite.contentDocument, arguments);
    nativeMethods.documentWriteLn.apply(iframeForNativeWrite.contentDocument, arguments);
}

function open () {
    iframeForWrite.contentDocument.open();
    nativeMethods.documentOpen.call(iframeForNativeWrite.contentDocument);
}

function close () {
    iframeForWrite.contentDocument.close();
    nativeMethods.documentClose.call(iframeForNativeWrite.contentDocument);
}

function getElems (iframe, selector) {
    return iframe.contentDocument.querySelectorAll(selector);
}

function innerHTML (el, isProxy) {
    if (!el)
        return '';

    return isProxy ? eval(processScript('el.innerHTML')) : el.innerHTML;
}

test('write incomplete tags', function () {
    write('<div id="div1"></div>');

    strictEqual(getElems(iframeForWrite, '#div1').length, getElems(iframeForNativeWrite, '#div1').length);

    write('<div id="div2">');

    strictEqual(getElems(iframeForWrite, '#div2').length, getElems(iframeForNativeWrite, '#div2').length);

    write('</div>');

    strictEqual(getElems(iframeForWrite, '#div2').length, getElems(iframeForNativeWrite, '#div2').length);

    write('<div id="div3"');

    strictEqual(getElems(iframeForWrite, '#div3').length, getElems(iframeForNativeWrite, '#div3').length);

    write('>');

    strictEqual(getElems(iframeForWrite, '#div3').length, getElems(iframeForNativeWrite, '#div3').length);

    write('content');

    strictEqual(innerHTML(getElems(iframeForWrite, '#div3')[0]), innerHTML(getElems(iframeForNativeWrite, '#div3')[0]));

    write('\nother content');

    strictEqual(innerHTML(getElems(iframeForWrite, '#div3')[0]), innerHTML(getElems(iframeForNativeWrite, '#div3')[0]));

    write('</div>');
    writeln('content');

    strictEqual(innerHTML(getElems(iframeForWrite, '#div3')[0]), innerHTML(getElems(iframeForNativeWrite, '#div3')[0]));
});

test('write script', function () {
    write('<script>');

    strictEqual(getElems(iframeForWrite, 'script').length, getElems(iframeForNativeWrite, 'script').length);

    write('var x = 5;');

    strictEqual(innerHTML(getElems(iframeForWrite, 'script')[0], true), innerHTML(getElems(iframeForNativeWrite, 'script')[0]));
    strictEqual(innerHTML(getElems(iframeForWrite, 'script')[0]), '');

    write('var y = x;');

    strictEqual(innerHTML(getElems(iframeForWrite, 'script')[0], true), innerHTML(getElems(iframeForNativeWrite, 'script')[0]));
    strictEqual(innerHTML(getElems(iframeForWrite, 'script')[0]), '');

    write('<\/script>');

    write('var z = x + y;');

    strictEqual(innerHTML(getElems(iframeForWrite, 'script')[0]).indexOf('var z = x + y;'),
        innerHTML(getElems(iframeForNativeWrite, 'script')[0]).indexOf('var z = x + y;'));


    write('<script>var x=a<b;');

    strictEqual(getElems(iframeForWrite, 'script').length, getElems(iframeForNativeWrite, 'script').length);
    strictEqual(innerHTML(getElems(iframeForWrite, 'script')[1], true), innerHTML(getElems(iframeForNativeWrite, 'script')[1]));
    strictEqual(innerHTML(getElems(iframeForWrite, 'script')[1]), '');

    write('<\/script>');

    strictEqual(innerHTML(getElems(iframeForWrite, 'script')[1]), processScript('var x=a<b;', true));
});

test('write style', function () {
    writeln('<style>');

    strictEqual(getElems(iframeForWrite, 'style').length, getElems(iframeForNativeWrite, 'style').length);

    writeln('div {}');

    strictEqual(innerHTML(getElems(iframeForWrite, 'style')[0], true), innerHTML(getElems(iframeForNativeWrite, 'style')[0]));
    strictEqual(innerHTML(getElems(iframeForWrite, 'style')[0]), '');

    writeln('</style><style>body {background-image: url(/image.png);}');

    strictEqual(getElems(iframeForWrite, 'style').length, getElems(iframeForNativeWrite, 'style').length);
    strictEqual(innerHTML(getElems(iframeForWrite, 'style')[0], true), innerHTML(getElems(iframeForNativeWrite, 'style')[0]));
    strictEqual(innerHTML(getElems(iframeForWrite, 'style')[0]), styleProcessor.STYLESHEET_PROCESSING_START_COMMENT +
                                                                 '\n\ndiv {}\n\n' +
                                                                 styleProcessor.STYLESHEET_PROCESSING_END_COMMENT);
    strictEqual(innerHTML(getElems(iframeForWrite, 'style')[1], true), innerHTML(getElems(iframeForNativeWrite, 'style')[1]));
    strictEqual(innerHTML(getElems(iframeForWrite, 'style')[1]), '');

    writeln('li {display:block;}</style><div></div>');

    ok(innerHTML(getElems(iframeForWrite, 'style')[1]).indexOf(urlUtils.getProxyUrl('/image.png')) > -1);
    strictEqual(iframeForWrite.contentDocument.body.children.length, iframeForNativeWrite.contentDocument.body.children.length);
});

test('document.write, document.writeln with multiple parameters', function () {
    write('w1', 'w2', 'w3');

    strictEqual(innerHTML(getElems(iframeForWrite, 'body')[0]), innerHTML(getElems(iframeForNativeWrite, 'body')[0]));

    writeln('wl1', 'wl2', 'wl3');

    strictEqual(innerHTML(getElems(iframeForWrite, 'body')[0]), innerHTML(getElems(iframeForNativeWrite, 'body')[0]));

    writeln('wl4');

    strictEqual(innerHTML(getElems(iframeForWrite, 'body')[0]), innerHTML(getElems(iframeForNativeWrite, 'body')[0]));

    writeln();

    strictEqual(innerHTML(getElems(iframeForWrite, 'body')[0]), innerHTML(getElems(iframeForNativeWrite, 'body')[0]));

    write();

    strictEqual(innerHTML(getElems(iframeForWrite, 'body')[0]), innerHTML(getElems(iframeForNativeWrite, 'body')[0]));
});

test('write html comment', function () {
    write('<div id="main"><!--');

    strictEqual(getElems(iframeForWrite, 'div').length, getElems(iframeForNativeWrite, 'div').length);
    strictEqual(innerHTML(getElems(iframeForWrite, 'div')[0]), innerHTML(getElems(iframeForNativeWrite, 'div')[0]));

    writeln('<div id="nonexistent">bla');

    strictEqual(innerHTML(getElems(iframeForWrite, 'div')[0]), innerHTML(getElems(iframeForNativeWrite, 'div')[0]));
    strictEqual(getElems(iframeForWrite, 'div').length, getElems(iframeForNativeWrite, 'div').length);

    writeln('this is comment');

    strictEqual(innerHTML(getElems(iframeForWrite, 'div')[0]), innerHTML(getElems(iframeForNativeWrite, 'div')[0]));

    write('-->');

    strictEqual(innerHTML(getElems(iframeForWrite, 'div')[0]), innerHTML(getElems(iframeForNativeWrite, 'div')[0]));

    write('<a href="/link"></a>');

    strictEqual(getElems(iframeForWrite, 'div a').length, getElems(iframeForNativeWrite, 'div a').length);
    strictEqual(getElems(iframeForWrite, 'div a')[0].href, urlUtils.getProxyUrl('/link', null, null, null, 'i'));

    write('</div>');

    strictEqual(getElems(iframeForWrite, '#nonexistent').length, getElems(iframeForNativeWrite, '#nonexistent').length);
});

test('write textarea', function () {
    write('<textarea>');

    strictEqual(getElems(iframeForWrite, 'textarea').length, getElems(iframeForNativeWrite, 'textarea').length);

    writeln('test');

    strictEqual(innerHTML(getElems(iframeForWrite, 'textarea')[0]), innerHTML(getElems(iframeForNativeWrite, 'textarea')[0]));

    writeln('other text');

    strictEqual(innerHTML(getElems(iframeForWrite, 'textarea')[0]), innerHTML(getElems(iframeForNativeWrite, 'textarea')[0]));

    write('</textarea>');

    strictEqual(innerHTML(getElems(iframeForWrite, 'textarea')[0]), innerHTML(getElems(iframeForNativeWrite, 'textarea')[0]));
});
