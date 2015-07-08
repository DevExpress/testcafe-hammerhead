var Style = Hammerhead.get('./util/style');

test('getBordersWidth', function () {
    var $el = $('<div>')
        .css({
            'border-color': 'black',
            'border-style': 'solid'
        })
        .appendTo('body');

    var defaultBrowserBorderWidthValue   = 3;
    var browserBorderWidthValueForMedium = 3;

    strictEqual(Style.getBordersWidth($el[0]).top, defaultBrowserBorderWidthValue);

    $el.css('borderTopWidth', 'medium');
    strictEqual(Style.getBordersWidth($el[0]).top, browserBorderWidthValueForMedium);

    $el.css('borderTopWidth', '10px');
    strictEqual(Style.getBordersWidth($el[0]).top, 10);
    strictEqual(Style.getBordersWidth(document.documentElement).top, 0);

    $el.remove();
});

test('getHeight', function () {
    strictEqual(Style.getHeight(null), null);
    strictEqual($(document).height(), Style.getHeight(document));

    var $select = $('<select>').appendTo(document.body);

    strictEqual($select.height(), Style.getHeight($select[0]));

    $select.css('marginTop', '10px');
    $select.css('marginBottom', '10px');
    $select.css('paddingTop', '10px');
    $select.css('paddingBottom', '10px');
    $select.css('borderTopWidth', '10px');
    $select.css('borderBottomWidth', '10px');
    strictEqual($select.height(), Style.getHeight($select[0]));

    $select.remove();
});

test('getScrollLeft, getScrollTop', function () {
    strictEqual(Style.getScrollLeft(null), $(null).scrollLeft());
    strictEqual(Style.getScrollTop(null), $(null).scrollTop());

    strictEqual(Style.getScrollLeft(window), $(window).scrollTop());
    strictEqual(Style.getScrollTop(window), $(window).scrollTop());

    strictEqual(Style.getScrollLeft(document), $(document).scrollLeft());
    strictEqual(Style.getScrollTop(document), $(document).scrollTop());

    var div       = document.createElement('div');
    var innerDiv  = document.createElement('div');
    var $innerDiv = $(innerDiv);

    document.body.appendChild(div);
    div.appendChild(innerDiv);

    $innerDiv.height($(document).height() * 2);
    $innerDiv.height($(document).height() * 2);
    $innerDiv.scrollLeft(100);
    $innerDiv.scrollTop(100);

    strictEqual(Style.getScrollLeft(innerDiv), $innerDiv.scrollLeft());
    strictEqual(Style.getScrollTop(innerDiv), $innerDiv.scrollTop());

    div.parentNode.removeChild(div);
});

test('setScrollLeft, setScrollTop', function () {
    Style.setScrollLeft(null, 100);
    Style.setScrollTop(null, 100);

    var $div      = $('<div>').appendTo('body');
    var $document = $(document);
    var $window   = $(window);

    $div.width($document.width() * 2);
    $div.height($document.height() * 2);
    $window.scrollLeft($document.width());
    $window.scrollTop($document.height());

    Style.setScrollLeft(window, 10);
    Style.setScrollTop(window, 20);

    strictEqual(10, $document.scrollLeft());
    strictEqual(20, $document.scrollTop());

    $window.scrollLeft($document.width());
    $window.scrollTop($document.height());

    Style.setScrollLeft(document, 10);
    Style.setScrollTop(document, 20);

    strictEqual(10, $document.scrollLeft());
    strictEqual(20, $document.scrollTop());

    $div.remove();
});

test('getInnerWidth', function () {
    strictEqual(Style.getInnerWidth(null), null);
    strictEqual($(window).innerWidth(), Style.getInnerWidth(window));
    strictEqual($(document).innerWidth(), Style.getInnerWidth(document));

    var $div = $('<div>').appendTo('body');

    $div.css('padding', '10px');
    $div.css('margin', '10px');
    $div.css('borderWidth', '10px');
    strictEqual($div.innerWidth(), Style.getInnerWidth($div[0]));

    $div.remove();
});

test('getOffsetParent', function () {
    strictEqual(Style.getOffsetParent(null), void 0);
    strictEqual(Style.getOffsetParent(window), document.body);
    strictEqual(Style.getOffsetParent(document), document.body);
    strictEqual(Style.getOffsetParent(document.documentElement), document.body);

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

    strictEqual(Style.getOffsetParent(liItemA), liItemII);

    document.body.removeChild(document.querySelector('ul.level-1'));
});

test('getOffset', function () {
    strictEqual(Style.getOffset(null), null);
    strictEqual(Style.getOffset(window), null);
    strictEqual(Style.getOffset(document), null);

    var offset  = Style.getOffset(document.documentElement);
    var $offset = $(document.documentElement).offset();

    strictEqual(offset.left, $offset.left);
    strictEqual(offset.top, $offset.top);

    var $div = $('<div>').appendTo('body');

    offset  = Style.getOffset($div[0]);
    $offset = $div.offset();
    strictEqual(offset.left, $offset.left);
    strictEqual(offset.top, $offset.top);

    $div.height($(document).height() * 2);
    $div.width($(document).width() * 2);
    window.scrollTo(100, 100);
    offset  = Style.getOffset($div[0]);
    $offset = $div.offset();
    strictEqual(offset.left, $offset.left);
    strictEqual(offset.top, $offset.top);

    document.body.style.border            = '10px solid red';
    document.documentElement.style.border = '15px solid black';
    offset                                = Style.getOffset($div[0]);
    $offset                               = $div.offset();
    strictEqual(offset.left, $offset.left);
    strictEqual(offset.top, $offset.top);

    $div.remove();

    document.body.style.border            = '';
    document.documentElement.style.border = '';
});
