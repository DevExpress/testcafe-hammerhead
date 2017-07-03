var styleUtils       = hammerhead.utils.style;
var browserUtils     = hammerhead.utils.browser;
var featureDetection = hammerhead.utils.featureDetection;

test('getBordersWidth', function () {
    var $el = $('<div>')
        .css({
            'border-color': 'black',
            'border-style': 'solid'
        })
        .appendTo('body');

    var defaultBrowserBorderWidthValue   = 3;
    var browserBorderWidthValueForMedium = 3;

    strictEqual(styleUtils.getBordersWidth($el[0]).top, defaultBrowserBorderWidthValue);

    $el.css('borderTopWidth', 'medium');
    strictEqual(styleUtils.getBordersWidth($el[0]).top, browserBorderWidthValueForMedium);

    $el.css('borderTopWidth', '10px');
    strictEqual(styleUtils.getBordersWidth($el[0]).top, 10);
    strictEqual(styleUtils.getBordersWidth(document.documentElement).top, 0);

    $el.remove();
});

test('getHeight', function () {
    strictEqual(styleUtils.getHeight(null), null);
    strictEqual($(document).height(), styleUtils.getHeight(document));

    var $select = $('<select>').appendTo(document.body);

    strictEqual($select.height(), styleUtils.getHeight($select[0]));

    $select.css('marginTop', '10px');
    $select.css('marginBottom', '10px');
    $select.css('paddingTop', '10px');
    $select.css('paddingBottom', '10px');
    $select.css('borderTopWidth', '10px');
    $select.css('borderBottomWidth', '10px');
    strictEqual($select.height(), styleUtils.getHeight($select[0]));

    $select.remove();
});

test('getScrollLeft, getScrollTop', function () {
    strictEqual(styleUtils.getScrollLeft(null), $(null).scrollLeft());
    strictEqual(styleUtils.getScrollTop(null), $(null).scrollTop());

    strictEqual(styleUtils.getScrollLeft(window), $(window).scrollTop());
    strictEqual(styleUtils.getScrollTop(window), $(window).scrollTop());

    strictEqual(styleUtils.getScrollLeft(document), $(document).scrollLeft());
    strictEqual(styleUtils.getScrollTop(document), $(document).scrollTop());

    var div       = document.createElement('div');
    var innerDiv  = document.createElement('div');
    var $innerDiv = $(innerDiv);

    document.body.appendChild(div);
    div.appendChild(innerDiv);

    $innerDiv.height($(document).height() * 2);
    $innerDiv.height($(document).height() * 2);
    $innerDiv.scrollLeft(100);
    $innerDiv.scrollTop(100);

    strictEqual(styleUtils.getScrollLeft(innerDiv), $innerDiv.scrollLeft());
    strictEqual(styleUtils.getScrollTop(innerDiv), $innerDiv.scrollTop());

    div.parentNode.removeChild(div);
});

test('setScrollLeft, setScrollTop', function () {
    styleUtils.setScrollLeft(null, 100);
    styleUtils.setScrollTop(null, 100);

    var $div      = $('<div>').appendTo('body');
    var $document = $(document);
    var $window   = $(window);

    $div.width($document.width() * 2);
    $div.height($document.height() * 2);
    $window.scrollLeft($document.width());
    $window.scrollTop($document.height());

    styleUtils.setScrollLeft(window, 10);
    styleUtils.setScrollTop(window, 20);

    strictEqual(10, $document.scrollLeft());
    strictEqual(20, $document.scrollTop());

    $window.scrollLeft($document.width());
    $window.scrollTop($document.height());

    styleUtils.setScrollLeft(document, 10);
    styleUtils.setScrollTop(document, 20);

    strictEqual(10, $document.scrollLeft());
    strictEqual(20, $document.scrollTop());

    $div.remove();
});

test('getInnerWidth', function () {
    strictEqual(styleUtils.getInnerWidth(null), null);
    strictEqual($(window).innerWidth(), styleUtils.getInnerWidth(window));
    strictEqual($(document).innerWidth(), styleUtils.getInnerWidth(document));

    var $div = $('<div>').appendTo('body');

    $div.css('padding', '10px');
    $div.css('margin', '10px');
    $div.css('borderWidth', '10px');
    strictEqual($div.innerWidth(), styleUtils.getInnerWidth($div[0]));

    $div.remove();
});

test('getOffsetParent', function () {
    strictEqual(styleUtils.getOffsetParent(null), void 0);
    strictEqual(styleUtils.getOffsetParent(window), document.body);
    strictEqual(styleUtils.getOffsetParent(document), document.body);
    strictEqual(styleUtils.getOffsetParent(document.documentElement), document.body);

    document.body.insertAdjacentHTML('beforeEnd', '<ul class="level-1">' +
                                                  '<li class="item-i">I</li>' +
                                                  '<li class="item-ii" style="position: relative;">II' +
                                                  '<ul class="level-2">' +
                                                  '<li class="item-a">A</li>' +
                                                  '<li class="item-b">B' +
                                                  '<ul class="level-3">' +
                                                  '<li class="item-1">1</li>' +
                                                  '<li class="item-2">2</li>' +
                                                  '<li class="item-3">3</li>' +
                                                  '</ul>' +
                                                  '</li>' +
                                                  '<li class="item-c">C</li>' +
                                                  '</ul>' +
                                                  '</li>' +
                                                  '<li class="item-iii">III</li>' +
                                                  '</ul>');

    var liItemA  = document.querySelector('li.item-a');
    var liItemII = document.querySelector('.item-ii');

    strictEqual(styleUtils.getOffsetParent(liItemA), liItemII);

    document.body.removeChild(document.querySelector('ul.level-1'));
});

test('getOffset', function () {
    strictEqual(styleUtils.getOffset(null), null);
    strictEqual(styleUtils.getOffset(window), null);
    strictEqual(styleUtils.getOffset(document), null);

    var offset  = styleUtils.getOffset(document.documentElement);
    var $offset = $(document.documentElement).offset();

    strictEqual(offset.left, $offset.left);
    strictEqual(offset.top, $offset.top);

    var $div = $('<div>').appendTo('body');

    offset  = styleUtils.getOffset($div[0]);
    $offset = $div.offset();
    strictEqual(offset.left, $offset.left);
    strictEqual(offset.top, $offset.top);

    $div.height($(document).height() * 2);
    $div.width($(document).width() * 2);
    window.scrollTo(100, 100);
    offset  = styleUtils.getOffset($div[0]);
    $offset = $div.offset();
    strictEqual(offset.left, $offset.left);
    strictEqual(offset.top, $offset.top);

    document.body.style.border            = '10px solid red';
    document.documentElement.style.border = '15px solid black';
    offset                                = styleUtils.getOffset($div[0]);
    $offset                               = $div.offset();

    strictEqual(offset.left, $offset.left);
    strictEqual(offset.top, $offset.top);

    $div.remove();

    document.body.style.border            = '';
    document.documentElement.style.border = '';
});

test('getSelectElementSize', function () {
    function createOption (parent, text) {
        return $('<option>').text(text)
            .appendTo(parent);
    }

    function createSelect () {
        var select = $('<select>')
            .appendTo(document.body)[0];

        createOption(select, 'one');
        createOption(select, 'two');
        createOption(select, 'three');
        createOption(select, 'four');
        createOption(select, 'five');

        return select;
    }

    var select = createSelect();
    var size   = styleUtils.getSelectElementSize(select);

    strictEqual(size, 1);

    select.setAttribute('size', 4);
    size = styleUtils.getSelectElementSize(select);

    if (browserUtils.isSafari && featureDetection.hasTouchEvents || browserUtils.isAndroid)
        strictEqual(size, 1);
    else
        strictEqual(size, 4);

    select.removeAttribute('size');
    select.setAttribute('multiple', 'multiple');

    if (browserUtils.isSafari && featureDetection.hasTouchEvents || browserUtils.isAndroid)
        strictEqual(size, 1);
    else
        strictEqual(size, 4);

    document.body.removeChild(select);
});

module('regression');

test('isStyle throws an error for objects without the toString method (GH-561)', function () {
    ok(!styleUtils.isStyle({ border: 0, toString: void 0 }));
});

test('isStyleSheet function should not throw the "Maximum call stack size exceeded" error for objects with the overridden toString method (GH-1055)', function () {
    ok(!styleUtils.isStyleSheet({
        toString: function () {
            return eval(processScript('this.href'));
        }
    }));
});
