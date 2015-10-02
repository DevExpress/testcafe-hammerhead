// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

var CONST = {};

CONST.DOM_SANDBOX_OVERRIDE_DOM_METHOD_NAME = 'hammerhead|override-dom-method';
CONST.DOM_SANDBOX_PROCESSED_CONTEXT        = 'hammerhead|processed-context';
CONST.EVENT_SANDBOX_WHICH_PROPERTY_WRAPPER = 'hammerhead|which-property-wrapper';
CONST.DOM_SANDBOX_STORED_ATTR_POSTFIX      = '-hammerhead-stored-value';

CONST.IS_STYLESHEET_PROCESSED_COMMENT = '/* stylesheet processed via hammerhead */';

CONST.UPLOAD_SANDBOX_HIDDEN_INPUT_NAME = 'hammerhead|upload-info-hidden-input';

CONST.HOVER_PSEUDO_CLASS_ATTR = 'data-hammerhead-hovered';
CONST.FOCUS_PSEUDO_CLASS_ATTR = 'data-hammerhead-focused';

CONST.DOCUMENT_CHARSET = 'hammerhead|document-charset';

CONST.SHADOW_UI_CLASSNAME_POSTFIX         = '-hammerhead-shadow-ui';
CONST.SHADOW_UI_CHARSET_CLASSNAME         = 'charset' + CONST.SHADOW_UI_CLASSNAME_POSTFIX;
CONST.SHADOW_UI_SCRIPT_CLASSNAME          = 'script' + CONST.SHADOW_UI_CLASSNAME_POSTFIX;
CONST.SHADOW_UI_STYLESHEET_CLASSNAME      = 'ui-stylesheet';
CONST.SHADOW_UI_STYLESHEET_FULL_CLASSNAME = CONST.SHADOW_UI_STYLESHEET_CLASSNAME +
                                            CONST.SHADOW_UI_CLASSNAME_POSTFIX;

export default CONST;
