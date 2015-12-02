import INTERNAL_ATTRS from '../../../processing/dom/internal-attributes';
import SandboxBase from '../base';
import nativeMethods from '../native-methods';
import * as domUtils from '../../utils/dom';

export default class HoverSandbox extends SandboxBase {
    constructor (listeners) {
        super();

        this.listeners = listeners;

        this.hoverElementFixed  = false;
        this.lastHoveredElement = null;
    }

    static _setHoverMarker (newHoveredElement, jointParent) {
        if (jointParent)
            nativeMethods.setAttribute.call(jointParent, INTERNAL_ATTRS.hoverPseudoClass, '');

        while (newHoveredElement && newHoveredElement.tagName) {
            // NOTE: Assign a pseudo-class marker to the elements until the joint parent is found.
            if (newHoveredElement !== jointParent) {
                nativeMethods.setAttribute.call(newHoveredElement, INTERNAL_ATTRS.hoverPseudoClass, '');
                newHoveredElement = newHoveredElement.parentNode;
            }
            else
                break;
        }
    }

    // NOTE: In this method, we go up to the tree of elements and look for a joint parent for the
    // previous and new hovered elements. Processing is needed only until  that parent is found.
    // In this case, we’ll  reduce the number of dom calls.
    _clearHoverMarkerUntilJointParent (newHoveredElement) {
        var jointParent = null;

        if (this.lastHoveredElement) {
            var el = this.lastHoveredElement;

            while (el && el.tagName) {
                // NOTE: Check that the current element is a joint parent for the hovered elements.
                if (el.contains && !el.contains(newHoveredElement)) {
                    nativeMethods.removeAttribute.call(el, INTERNAL_ATTRS.hoverPseudoClass);
                    el = el.parentNode;
                }
                else
                    break;
            }

            jointParent = el;

            if (jointParent)
                nativeMethods.removeAttribute.call(jointParent, INTERNAL_ATTRS.hoverPseudoClass);
        }

        return jointParent;
    }

    _hover (el) {
        if (!this.hoverElementFixed && !domUtils.isShadowUIElement(el)) {
            var jointParent = this._clearHoverMarkerUntilJointParent(el);

            HoverSandbox._setHoverMarker(el, jointParent);

            this.lastHoveredElement = el;
        }
    }

    fixHoveredElement () {
        this.hoverElementFixed = true;
    }

    freeHoveredElement () {
        this.hoverElementFixed = false;
    }

    attach (window) {
        super.attach(window);

        this.listeners.addInternalEventListener(window, ['mouseover', 'touchstart'], e => this._hover(e.target));
    }
}
