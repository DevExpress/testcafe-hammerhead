import INTERNAL_ATTRS from '../../../processing/dom/internal-attributes';
import SandboxBase from '../base';
import nativeMethods from '../native-methods';
import * as domUtils from '../../utils/dom';
import Listeners from './listeners';

export default class HoverSandbox extends SandboxBase {
    private _hoverElementFixed = false;
    private _lastHoveredElement: any = null;

    constructor (private readonly _listeners: Listeners) { //eslint-disable-line no-unused-vars
        super();
    }

    static _setHoverMarker (newHoveredElement, jointParent) {
        if (jointParent)
            nativeMethods.setAttribute.call(jointParent, INTERNAL_ATTRS.hoverPseudoClass, '');

        while (newHoveredElement && newHoveredElement.tagName) {
            // NOTE: Assign a pseudo-class marker to the elements until the joint parent is found.
            if (newHoveredElement !== jointParent) {
                nativeMethods.setAttribute.call(newHoveredElement, INTERNAL_ATTRS.hoverPseudoClass, '');

                const associatedElement = domUtils.getAssociatedElement(newHoveredElement);

                if (associatedElement)
                    nativeMethods.setAttribute.call(associatedElement, INTERNAL_ATTRS.hoverPseudoClass, '');

                newHoveredElement = nativeMethods.nodeParentNodeGetter.call(newHoveredElement);
            }
            else
                break;
        }
    }

    // NOTE: In this method, we go up to the tree of elements and look for a joint parent for the
    // previous and new hovered elements. Processing is needed only until  that parent is found.
    // In this case, we'll reduce the number of dom calls.
    _clearHoverMarkerUntilJointParent (newHoveredElement) {
        let jointParent = null;

        if (this._lastHoveredElement) {
            let el = this._lastHoveredElement;

            while (el && el.tagName && el.contains) {
                const associatedElement = domUtils.getAssociatedElement(el);

                if (associatedElement)
                    nativeMethods.removeAttribute.call(associatedElement, INTERNAL_ATTRS.hoverPseudoClass);

                // NOTE: Check that the current element is a joint parent for the hovered elements.
                if (!el.contains(newHoveredElement)) {
                    nativeMethods.removeAttribute.call(el, INTERNAL_ATTRS.hoverPseudoClass);
                    el = nativeMethods.nodeParentNodeGetter.call(el);
                }
                else {
                    jointParent = el;
                    break;
                }
            }

            if (jointParent)
                nativeMethods.removeAttribute.call(jointParent, INTERNAL_ATTRS.hoverPseudoClass);
        }

        return jointParent;
    }

    _onHover (e: MouseEvent) {
        const target = nativeMethods.eventTargetGetter.call(e);

        this._hover(target);
    }

    _hover (el) {
        if (!this._hoverElementFixed && !domUtils.isShadowUIElement(el)) {
            const jointParent = this._clearHoverMarkerUntilJointParent(el);

            HoverSandbox._setHoverMarker(el, jointParent);

            this._lastHoveredElement = el;
        }
    }

    fixHoveredElement () {
        this._hoverElementFixed = true;
    }

    freeHoveredElement () {
        this._hoverElementFixed = false;
    }

    attach (window: Window & typeof globalThis) {
        super.attach(window);

        this._listeners.addInternalEventBeforeListener(window, ['mouseover', 'touchstart'], e => this._onHover(e));
    }

    dispose () {
        this._lastHoveredElement = null;
    }
}
