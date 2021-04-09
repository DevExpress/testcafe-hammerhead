var INTERNAL_ATTRS = hammerhead.PROCESSING_INSTRUCTIONS.dom.internal_attributes;

var hover            = hammerhead.sandbox.event.hover;
var featureDetection = hammerhead.utils.featureDetection;
var eventSimulator   = hammerhead.sandbox.event.eventSimulator;

function hoverElement (el) {
    if (featureDetection.hasTouchEvents)
        eventSimulator.touchstart(el, {});
    else
        eventSimulator.mouseover(el, { relatedTarget: document.documentElement });
}

function isHovered (el) {
    return el.getAttribute(INTERNAL_ATTRS.hoverPseudoClass) === '';
}

test('hover pseudo class', function () {
    var $parent = $('<div style="width:100px; height:100px; background-color: Red" class="parent">').appendTo($('body'));
    var $child  = $('<div style="width:50px; height:50px; background-color: Blue" class="child">').appendTo($parent);

    ok(!isHovered($parent[0]));
    ok(!isHovered($child[0]));

    hoverElement($parent[0]);
    ok(isHovered($parent[0]));
    ok(!isHovered($child[0]));

    hoverElement($child[0]);
    ok(isHovered($parent[0]));
    ok(isHovered($child[0]));

    hoverElement($('body')[0]);
    ok(!isHovered($parent[0]));
    ok(!isHovered($child[0]));

    $parent.remove();
    $child.remove();
});

test('hover.fixHoveredElement, hover.freeHoveredElement (B254111)', function () {
    var $parent = $('<div style="width:100px; height:100px; background-color: Red" class="parent">').appendTo($('body'));
    var $child  = $('<div style="width:50px; height:50px; background-color: Blue" class="child">').appendTo($parent);

    ok(!isHovered($parent[0]));
    ok(!isHovered($child[0]));

    hover.fixHoveredElement();

    hoverElement($parent[0]);
    ok(!isHovered($parent[0]));
    ok(!isHovered($child[0]));

    hover.freeHoveredElement();

    hoverElement($child[0]);
    ok(isHovered($parent[0]));
    ok(isHovered($child[0]));

    hoverElement($('body')[0]);
    ok(!isHovered($parent[0]));
    ok(!isHovered($child[0]));

    $parent.remove();
    $child.remove();
});

test('Hovering element which is not in the DOM (GH-345)', function () {
    var el1 = document.createElement('div');
    var el2 = document.createElement('div');

    document.body.appendChild(el1);
    hover._hover(el1);
    ok(isHovered(el1));
    ok(!isHovered(el2));

    hover._hover(el2);
    ok(isHovered(el2));
    ok(!isHovered(el1));

    document.body.removeChild(el1);
});

test('Hovering label with associated control', function () {
    var style = document.createElement('style');
    var div   = document.createElement('div');

    style.innerHTML = '.custom-control {' +
                      '    position: relative;' +
                      '    padding-left: 40px;' +
                      '}' +
                      '.custom-radio .custom-control-label::before {' +
                      '    background-color: #000;' +
                      '}' +
                      '.custom-radio .custom-control-input {' +
                      '    opacity: 0;' +
                      '    width: 1px;' +
                      '    height: 1px;' +
                      '    position: absolute;' +
                      '    left: 5px;' +
                      '    top: 10px;' +
                      '}' +
                      '.custom-radio .custom-control-input:hover ~ .custom-control-label::before {' +
                      '    background-color: rgb(255, 0, 0);' +
                      '}' +
                      '.custom-control-label:before {' +
                      '    background-color: #fff;' +
                      '    border: 1px solid #adb5bd;' +
                      '    background-color: #000;' +
                      '    border-radius: 50%;' +
                      '    position: absolute;' +
                      '    top: 0;' +
                      '    left: 0;' +
                      '    display: block;' +
                      '    width: 20px;' +
                      '    height: 20px;' +
                      '    content: "";' +
                      '}';

    div.innerHTML = '<div class="custom-control custom-radio">' +
                    '    <input type="radio" class="custom-control-input" value="warm" id="radio1">' +
                    '    <label class="custom-control-label" for="radio1"><span>radio 1</span></label>' +
                    '</div>' +
                    '<div class="custom-control custom-radio">' +
                    '    <input type="radio" class="custom-control-input" value="warm" id="radio2">' +
                    '    <label class="custom-control-label" for="radio2"><span>radio 2</span></label>' +
                    '</div>';


    document.body.appendChild(style);
    document.body.appendChild(div);

    var label1 = document.querySelectorAll('label')[0];
    var label2 = document.querySelectorAll('label')[1];

    strictEqual('rgb(0, 0, 0)', getComputedStyle(label1, ':before').backgroundColor);
    strictEqual('rgb(0, 0, 0)', getComputedStyle(label2, ':before').backgroundColor);

    hoverElement(label1);

    strictEqual('rgb(255, 0, 0)', getComputedStyle(label1, ':before').backgroundColor);
    strictEqual('rgb(0, 0, 0)', getComputedStyle(label2, ':before').backgroundColor);

    hoverElement(label2);

    strictEqual('rgb(0, 0, 0)', getComputedStyle(label1, ':before').backgroundColor);
    strictEqual('rgb(255, 0, 0)', getComputedStyle(label2, ':before').backgroundColor);

    document.body.removeChild(style);
    document.body.removeChild(div);
});

module('regression');

test('should not throw an error for the div element with the control property (GH-2287)', function () {
    var div = document.createElement('div');

    div.control = 'some';

    document.body.appendChild(div);
    hover._hover(div);
    ok(isHovered(div));

    document.body.removeChild(div);
});
