var DomProcessor    = Hammerhead.get('./dom-processor/dom-processor');
var ScriptProcessor = Hammerhead.get('../processing/script');
var Html            = Hammerhead.get('./util/html');
var IFrameSandbox   = Hammerhead.get('./sandboxes/iframe');
var NativeMethods   = Hammerhead.get('./sandboxes/native-methods');
var ScriptProcessor = Hammerhead.get('../processing/script');
var ShadowUI        = Hammerhead.get('./sandboxes/shadow-ui');
var Const           = Hammerhead.get('../const');
var SharedUrlUtil   = Hammerhead.get('../utils/url');
var UrlUtil         = Hammerhead.get('./util/url');

QUnit.testStart = function () {
    IFrameSandbox.on(IFrameSandbox.IFRAME_READY_TO_INIT, initIFrameTestHandler);
    IFrameSandbox.off(IFrameSandbox.IFRAME_READY_TO_INIT, IFrameSandbox.iframeReadyToInitHandler);
};

QUnit.testDone = function () {
    IFrameSandbox.off(IFrameSandbox.IFRAME_READY_TO_INIT, initIFrameTestHandler);
};

module('clean up html');

test('hover marker', function () {
    var storedGetProxyUrl = UrlUtil.getProxyUrl;

    UrlUtil.getProxyUrl = function (url) {
        return url + '_proxy';
    };

    var html = '<a href="http://domain.com"></a>' +
               '<div ' + Const.HOVER_PSEUDO_CLASS_ATTR + '></div>' +
               '<div ' + Const.HOVER_PSEUDO_CLASS_ATTR + '=""></div>';

    var expexted     = '<a href="http://domain.com"></a><div></div><div></div>';
    var pocessedHtml = Html.processHtml(html);

    strictEqual(Html.cleanUpHtml(pocessedHtml), expexted);

    UrlUtil.getProxyUrl = storedGetProxyUrl;
});

test('shadow ui elements', function () {
    var uiElem = document.createElement('div');

    uiElem.id = 'uiElem';

    ShadowUI.addClass(uiElem, 'ui-elem-class');

    var el = document.createElement('div');

    el.appendChild(uiElem);

    var html = '<head>' + el.innerHTML + '</head><body>' + el.innerHTML + '</body>';

    strictEqual(Html.cleanUpHtml(html), '<head></head><body></body>');
});

test('form', function () {
    var storedGetProxyUrl = UrlUtil.getProxyUrl;

    UrlUtil.getProxyUrl = function (url) {
        return url + '_proxy';
    };

    var url          = 'http://domain.com';
    var pocessedHtml = '<form action="' + UrlUtil.getProxyUrl(url) + '" ' +
                       DomProcessor.getStoredAttrName('action') + '="' + url + '"></form>';
    var expexted     = '<form action="http://domain.com"></form>';

    strictEqual(Html.cleanUpHtml(pocessedHtml), expexted);

    UrlUtil.getProxyUrl = storedGetProxyUrl;
});

//T226885: Hammerhead breaks Xenarius Designer
test('script', function () {
    var code    = 'var t = 1;';
    var $script = $('<script>' + code + '<\/script>');

    notEqual($script[0].innerHTML.replace(/^\s*|\s*$/g, ''), code);
    strictEqual(eval(processScript('$script[0].innerHTML')).replace(/^\s*|\s*$/g, ''), code);

    $script.remove();
});

//T112153 - Click (Touch) events being swallowed when using a combination of TestCafé 14.1.1 + KendoUI Mobile + iOS
test('attributes', function () {
    var html =
            // <script type="script/x-kendo-template" id="inboxItem">
            '<h3 class="time">#: Time#</h3><h3>#: From #</h3>\n' +
            '<a class="reply"\n' +
            'data-role="button"\n' +
            'data-rel="actionsheet"\n' +
            'href="\\\\#inboxActions"\n' +
            'data-actionsheet-context="#:ID#">Reply</a>\n' +
            '<h2>#: Subject#</h2>\n' +
            '<p>#: Text#</p>';

    // </script\>

    strictEqual(Html.cleanUpHtml(html).replace(/\s/g, ''), html.replace(/\s/g, ''));
});

module('process html');

test('iframe', function () {
    var originConvertToProxyUrl = UrlUtil.convertToProxyUrl;
    var originParseProxyUrl     = SharedUrlUtil.parseProxyUrl;

    UrlUtil.convertToProxyUrl = function (url, isIFrame) {
        return 'http://example.proxy.com/' + (isIFrame ? 'iframe' : '');
    };

    SharedUrlUtil.parseProxyUrl = function () {
        var result = {};

        result.originResourceInfo = UrlUtil.parseUrl('http://example.com/');

        return result;
    };

    ok(Html.processHtml('<iframe src="http://example.com/">')
           .indexOf('http://example.proxy.com/iframe') !== -1);

    UrlUtil.convertToProxyUrl   = originConvertToProxyUrl;
    SharedUrlUtil.parseProxyUrl = originParseProxyUrl;
});

test('element with error in attribute', function () {
    var originalUrl  = 'http://example.com/';
    var src          = '<script data-src="' + originalUrl + '"></script\>';
    var processedSrc = src;

    src = Html.processHtml(src);

    strictEqual(src, processedSrc);
});

test('encoded symbols', function () {
    var div            = document.createElement('div');
    var tag            = 'a';
    var attr           = 'href';
    var storedAttr     = DomProcessor.getStoredAttrName(attr);
    var urlEncoded     = 'http://example.com/?x=&lt;&y=5';
    var urlDecoded     = 'http://example.com/?x=<&y=5';
    var divForEncoding = document.createElement('div');

    divForEncoding.textContent = UrlUtil.getProxyUrl(urlDecoded);

    var proxyEncoded  = divForEncoding.innerHTML;
    var html          = '<' + tag + ' ' + attr + '="' + urlEncoded + '"></' + tag + '>';
    var processedHTML = '<' + tag + ' ' + attr + '="' + proxyEncoded + '" ' + storedAttr + '="' + urlEncoded + '"></' +
                        tag + '>';

    div.innerHTML = Html.processHtml(html) + processedHTML;

    strictEqual(NativeMethods.getAttribute.call(div.firstChild, attr), NativeMethods.getAttribute.call(div.lastChild, attr));
    strictEqual(NativeMethods.getAttribute.call(div.firstChild, storedAttr), NativeMethods.getAttribute.call(div.lastChild, storedAttr));
});

test('text node', function () {
    var error = false;

    window.onerror = function () {
        error = true;
    };

    Html.processHtml('some text', 'div');

    ok(!error);
});

test('script inner html', function () {
    var html = Html.processHtml('var v = a && b;', 'script');

    strictEqual(html.replace(/\s/g, ''), (ScriptProcessor.SCRIPT_HEADER + 'var v = a && b;').replace(/\s/g, ''));
});

test('html fragment', function () {
    var storedGetProxyUrl = UrlUtil.getProxyUrl;
    var htmlToProcess     = $('<a href="www.google.com">Link</a>')[0].innerHTML;
    var processedHTML     = $('<a href="replaced" ' + DomProcessor.getStoredAttrName('href') +
                              '="www.google.com">Link</a>')[0].innerHTML;

    UrlUtil.getProxyUrl = function () {
        return 'replaced';
    };

    var checkFragment = function (html, parentTag) {
        var src      = html.replace('%s', htmlToProcess);
        var expected = html.replace('%s', processedHTML);

        strictEqual(Html.processHtml(src, parentTag).replace(/\s/g, ''), expected.replace(/\s/g, ''));
    };

    checkFragment('<td>%s</td><td>Content</td>', 'tr');
    checkFragment('<td>Content1</td><td>Content2</td>', 'tr');
    checkFragment('<tr><td>%s</td><td>Content</td></tr>', 'table');
    checkFragment('<tr><td>Content1</td><td>Content2</td></tr>', 'table');
    checkFragment('%s', 'html');
    checkFragment('<div>Content</div>', 'html');

    UrlUtil.getProxyUrl = storedGetProxyUrl;
});

test('text nodes', function () {
    var hoverAttr = Const.HOVER_PSEUDO_CLASS_ATTR;

    var check = function (html) {
        var processedHtml = Html.cleanUpHtml('<div ' + hoverAttr + '="">' + html + '</div>');

        strictEqual(processedHtml, '<div>' + html + '</div>');
    };

    check('<table> \n\t <tfoot>textNode</tfoot><tbody> \n\t <tr> \n\t </tr></tbody></table>');
    check('<table> textNode' +
          '<thead>textNode</thead>textNode' +
          '<tfoot>textNode</tfoot>textNode' +
          '<tbody>textNode' +
          '<tr>textNode' +
          '<td>textNode</td>textNode' +
          '</tr>textNode' +
          '</tbody>textNode' +
          '</table>');
});

test('page html', function () {
    var storedGetProxyUrl = UrlUtil.getProxyUrl;

    UrlUtil.getProxyUrl = function (url) {
        return 'replaced' + url;
    };

    var check = function (html) {
        var processedHtml = Html.processHtml(html);

        ok(processedHtml.indexOf('replacedBodyScript.js') !== -1);
        ok(processedHtml.indexOf('replacedHeadScript.js') !== -1);
        strictEqual(html, Html.cleanUpHtml(processedHtml));
    };

    check('<!DOCTYPE html><html><head><script src="HeadScript.js"><\/script></head><body><script src="BodyScript.js"><\/script></body></html>');
    check('<html><head><script src="HeadScript.js"><\/script></head><body><script src="BodyScript.js"><\/script></body></html>');
    check('<head><script src="HeadScript.js"><\/script></head><body><script src="BodyScript.js"><\/script></body>');
    check('<head><script src="HeadScript.js"><\/script><script src="BodyScript.js"><\/script></head>');
    check('<body><script src="HeadScript.js"><\/script><script src="BodyScript.js"><\/script></body>');
    check('<!DOCTYPE html><html><head><script src="HeadScript.js"><\/script></head><body>\u2028\u2029<script src="BodyScript.js"><\/script></body></html>');
    check('<html><head><script src="HeadScript.js"><\/script></head><body>\u2028\u2029<script src="BodyScript.js"><\/script></body></html>');
    check('<head param="value"><script src="HeadScript.js"><\/script></head><body>\u2028\u2029<script src="BodyScript.js"><\/script></body>');
    check('<head>\u2028\u2029<script src="HeadScript.js"><\/script></head><body param="value"><script src="BodyScript.js"><\/script></body>');
    check('<body><script src="HeadScript.js"><\/script>\u2028\u2029<script src="BodyScript.js"><\/script></body>');
    check('<body><script src="HeadScript.js"><\/script>\u2028\u2029<script src="BodyScript.js"><\/script></body>');
    check('<!DOCTYPE html><html><head><script src="HeadScript.js"><\/script></head><body><script src="BodyScript.js"><\/script>');
    check('<html><head><script src="HeadScript.js"><\/script></head><body><script src="BodyScript.js"><\/script>');

    UrlUtil.getProxyUrl = storedGetProxyUrl;
});

test('init script for iframe template', function () {
    var pageHtmlTemplates = [
        '<!doctype><html><head>{0}</head><body>{0}</body></html>',
        '<html><head>{0}</head><body>{0}</body></html>',
        '<head>{0}</head>',
        '<body>{0}</body>'
    ];

    var check = function (template) {
        var html                  = template.replace(/\{0\}/g, '');
        var expectedProcessedHtml = template.replace(/\{0\}/g, Html.INIT_SCRIPT_FOR_IFRAME_TEMPLATE);
        var processedHtml         = Html.processHtml(html);

        strictEqual(processedHtml, expectedProcessedHtml);
        strictEqual(Html.cleanUpHtml(processedHtml), html);
    };

    for (var i = 0; i < pageHtmlTemplates.length; i++)
        check(pageHtmlTemplates[i]);
});

//T226655: 15.1 Testing - Hammerhead DomSandboxUtil.processHtml function does not process body/head/html attributes
test('body attributes', function () {
    var attrValue         = 'var js = document.createElement(\'script\');js.src = \'http://google.com\'; document.body.appendChild(js);';
    var expectedAttrValue = ScriptProcessor.process(attrValue, true).replace(/\s/g, '');
    var html              = '<body onload="' + attrValue + '">';

    ok(Html.processHtml(html).replace(/\s/g, '').replace(/&quot;/ig, '"').indexOf(expectedAttrValue) !== -1);
});

module('is well formatted tag');

test('special cases', function () {
    //single tags with plain text
    strictEqual(Html.isWellFormattedHtml(''), true);
    strictEqual(Html.isWellFormattedHtml('test<div />blablabla'), true);

    //script, style
    strictEqual(Html.isWellFormattedHtml('<script type="text/javascript" src="URL">alert("hello");<\/script>'), true);
    strictEqual(Html.isWellFormattedHtml('<div><style type="text/css">div > h1 { font-size: 120%; }<\/style></div>'), true);

    //html comments and ie-specific comments
    strictEqual(Html.isWellFormattedHtml('test<!--Html comment-->blablabla'), true);
    strictEqual(Html.isWellFormattedHtml('<head><style type="text/css">P { color: green; }</style><!--[if IE 7]><style type="text/css"> P { color: red; }</style><![endif]--></head>'), true);

    //doctype
    strictEqual(Html.isWellFormattedHtml('<!DOCTYPE html> '), true);
    strictEqual(Html.isWellFormattedHtml('<!DOCTYPE HTML PUBLIC \n "-//W3C//DTD HTML 4.01//EN" \n "http://www.w3.org/TR/html4/strict.dtd">'), true);

    //empty tags
    strictEqual(Html.isWellFormattedHtml('<div><br></div>'), true);
    strictEqual(Html.isWellFormattedHtml('<div><br /></div>'), true);
    strictEqual(Html.isWellFormattedHtml('<div><input></input></div>'), false);
    strictEqual(Html.isWellFormattedHtml('<div><input><img></input></div>'), false);

    //self closed
    strictEqual(Html.isWellFormattedHtml('<table><colgroup width="1"><tr><td></td></tr></table>'), true);
    strictEqual(Html.isWellFormattedHtml('<table><colgroup width="1"><col span="1"><col span="1"></colgroup><tr><td></td></tr></table>'), true);
    strictEqual(Html.isWellFormattedHtml('<table><colgroup width="150"><colgroup><col span="1"><col span="2"></colgroup><tr><td></td></tr></table>'), true);

    //upper case, new line
    strictEqual(Html.isWellFormattedHtml(' \n <div ></DIV>'), true);
    strictEqual(Html.isWellFormattedHtml('<div id="test">\n <div class="inner">\n blablabla </div> \n </div>'), true);
    strictEqual(Html.isWellFormattedHtml('<script>if (mr.slidotype_on) \n {mr.logoTrigger = document.getElementById("logo"); \n mr.logoTrigger.onclick = "mr.slidotypeClicked = true;"; \n }<\/script>'), true);
    strictEqual(Html.isWellFormattedHtml('<div \n id="test" \n />'), true);

    //negative scenarious
    strictEqual(Html.isWellFormattedHtml('test<div>blablabla'), false);
    strictEqual(Html.isWellFormattedHtml('<div>'), false);
    strictEqual(Html.isWellFormattedHtml('<div><span id="test"></span>'), false);
    strictEqual(Html.isWellFormattedHtml('<div id="test"><span id="test">'), false);
    strictEqual(Html.isWellFormattedHtml('<div /><span>'), false);
    strictEqual(Html.isWellFormattedHtml('<div><span><input>'), false);
    strictEqual(Html.isWellFormattedHtml('<div id="test"></span>'), false);
    strictEqual(Html.isWellFormattedHtml('<div class="some class" id="my_id"><span id="test"><input'), false);
    strictEqual(Html.isWellFormattedHtml('<input id="id" class="some class"'), false);
});

asyncTest('real big page - https://mail.ru page', function () {
    function checkNode (node) {
        var innerHTML = node.innerHTML;
        var outerHTML = node.outerHTML;

        ok(Html.isWellFormattedHtml(outerHTML));

        if (innerHTML) {
            var parts = outerHTML.split(innerHTML);

            ok(!Html.isWellFormattedHtml(parts[0] + innerHTML));
            ok(!Html.isWellFormattedHtml(innerHTML + parts[1]));
        }

        $(node).contents().each(function () {
            checkNode(this);
        });
    }

    $('<iframe src="/data/dom-sandbox/is-well-formatted-html.html">').load(function () {
        checkNode(this.contentDocument.documentElement);
        $(this).remove();

        start();
    }).appendTo('body');
});

