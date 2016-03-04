var INTERNAL_ATTRS = hammerhead.get('../processing/dom/internal-attributes');

var hover          = hammerhead.sandbox.event.hover;
var browserUtils   = hammerhead.utils.browser;
var eventSimulator = hammerhead.sandbox.event.eventSimulator;
var hoverSandbox   = hammerhead.sandbox.event.hover;

function hoverElement (el) {
    if (browserUtils.hasTouchEvents)
        eventSimulator.touchstart(el, {});
    else
        eventSimulator.mouseover(el, {});
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
    hoverSandbox._hover(el1);
    ok(isHovered(el1));
    ok(!isHovered(el2));

    hoverSandbox._hover(el2);
    ok(isHovered(el2));
    ok(!isHovered(el1));

    document.body.removeChild(el1);
});
