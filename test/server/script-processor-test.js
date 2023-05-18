const { expect }                                  = require('chai');
const multiline                                   = require('multiline');
const { processScript, isScriptProcessed }        = require('../../lib/processing/script');
const { HEADER, SCRIPT_PROCESSING_START_COMMENT } = require('../../lib/processing/script/header');
const {
    PROPERTIES: INSTRUMENTED_PROPERTIES,
    METHODS: INSTRUMENTED_METHODS,
} = require('../../lib/processing/script/instrumented');

const ACORN_UNICODE_PATCH_WARNING = multiline(function () {/*
 ATTENTION! If this test fails, this may happen because you have updated acorn.
 We have patched acorn to enable it to work with unicode identifiers.

 HOW TO FIX - go to acorn and replace the following code:
 ```
 function readWord1() {
    ...
    word += codePointToString(esc)
    ...
 }
 ```

 with the code below:

 ```
 function readWord1() {
    ...
    word += this.input.substr(this.pos-6, 6);
    ...
 }
 ```
*/
});

const ACORN_STRICT_MODE_PATCH_WARNING = multiline(function () {/*
 ATTENTION! If this test fails, this may happen because you have updated acorn.
 We have patched acorn to enable it to work with ES6 syntax in strict mode.

 HOW TO FIX - go to acorn and replace the following code:
 ```
 strictDirective = function(start) {
     ...
     if ((match[1] || match[2]) == "use strict") return true
     ...
 }
 ```

 with the code below:

 ```
 strictDirective = function(start) {
    ...
    if ((match[1] || match[2]) == "use strict") return false
    ...
 }
 ```
*/
});

const ESOTOPE_RAW_LITERAL_PATCH_WARNING = multiline(function () {/*
 ATTENTION! If this test fails, this may happen because you have updated esotope.
 We have patched esotope to enable it to work with raw literals without additional parsing.

 HOW TO FIX - go to esotope and replace the following code:

 ```
 if (parse && extra.raw && canUseRawLiteral($expr))
    _.js += $expr.raw;
 ```

 with the code below:

 ```
 if (extra.raw && $expr.raw !== void 0)
    _.js += $expr.raw;
 ```
 */
});


function normalizeCode (code) {
    return code
        .replace(/(\r\n|\n|\r)/gm, ' ')
        .replace(/'/gm, '"')
        .replace(/\s+/gm, '');
}

function testProcessing (testCases) {
    testCases = Array.isArray(testCases) ? testCases : [testCases];

    testCases.forEach(testCase => {
        const processed = processScript(testCase.src, false, false, url =>
            'http://localhost:3000/ksadjo23/http://example.com/' + (url === './' ? '' : url));
        const actual    = normalizeCode(processed);
        const expected  = normalizeCode(testCase.expected);
        let msg         = 'Source: ' + testCase.src + '\n' +
                          'Result: ' + processed + '\n' +
                          'Expected: ' + testCase.expected + '\n';

        if (testCase.msg)
            msg += '\n\n' + testCase.msg;

        expect(actual).eql(expected, msg);
    });
}

function testPropertyProcessing (templates) {
    INSTRUMENTED_PROPERTIES.forEach(propName => {
        if (propName.indexOf('-') !== -1)
            return;

        const testCases = templates.map(template => {
            return {
                src:      template.src.replace(/\{0}/g, propName),
                expected: template.expected.replace(/\{0}/g, propName),
            };
        });

        testProcessing(testCases);
    });
}

function testMethodProcessing (templates) {
    INSTRUMENTED_METHODS.forEach(propName => {
        if (propName.indexOf('-') !== -1)
            return;

        const testCases = templates.map(template => {
            return {
                src:      template.src.replace(/\{0}/g, propName),
                expected: template.expected.replace(/\{0}/g, propName),
            };
        });

        testProcessing(testCases);
    });
}

function assertHasHeader (expected, testCases) {
    testCases.forEach(src => {
        const processed = processScript(src, true);
        const hasHeader = processed.indexOf(HEADER) > -1;
        const msg       = 'Source: ' + src + '\n';

        expect(hasHeader).eql(expected, msg);
    });
}

describe('Script processor', () => {
    describe('Processing header', () => {
        it('Should add processing header', () => {
            assertHasHeader(true, [
                'var a = 42;',
                '[]; var a = 42; []',
                '{ var a = 42; }',
            ]);
        });

        it('Should not add processing header for the data script', () => {
            assertHasHeader(false, [
                '[1, 2, 3]',
                '{ a: 42 }',
            ]);
        });

        it('Should not add processing header twice', () => {
            const src        = 'var a = 42;';
            const processed1 = processScript(src, true);
            const processed2 = processScript(processed1, true);

            expect(normalizeCode(processed1)).eql(normalizeCode(processed2));
        });
    });

    it('Should determine if script was processed', () => {
        const src       = '//comment\n var temp = 0; \n var host = location.host; \n temp = 1; \n // comment';
        const processed = processScript(src, false);

        expect(isScriptProcessed(src)).to.be.false;
        expect(isScriptProcessed(processed)).to.be.true;
    });

    it('Should add the strict mode directive before the script header', () => {
        const src       = '/*comment*/\n' +
                          '"use strict";\n' +
                          'location.host = "host";';
        const processed = processScript(src, true);

        expect(isScriptProcessed(processed)).to.be.true;
        expect(processed.indexOf(SCRIPT_PROCESSING_START_COMMENT + '"use strict";')).eql(0);
    });

    it('Should process location getters and setters', () => {
        testProcessing([
            { src: 'var location = value', expected: 'var location = value' },
            {
                src:      'location = value',
                expected: '0,function(){var _hh$temp0 = value; return __set$Loc(location,_hh$temp0)||(location=_hh$temp0);}.call(this)',
            },
            {
                src:      '{ location: 123 }',
                expected: '{ location: 123 }',
            },
            { src: '[ location ]', expected: '[ __get$Loc(location) ]' },
            { src: 'var loc = location', expected: 'var loc = __get$Loc(location)' },
            { src: 'location ? true : false', expected: '__get$Loc(location) ? true : false' },
            { src: 'location + ""', expected: '__get$Loc(location) + ""' },
            { src: 'location[hostname]', expected: '__get$(__get$Loc(location), hostname)' },
            { src: 'location.href', expected: '__get$(__get$Loc(location), "href")' },
            { src: 'var func = function(location){}', expected: 'var func = function(location){}' },
            { src: 'function func(location){}', expected: 'function func(location){}' },
            { src: 'location[someProperty]', expected: '__get$(__get$Loc(location), someProperty)' },
            {
                src:      'obj.location = location = value;',
                expected: '__set$(obj, "location", function(){var _hh$temp0 = value; return __set$Loc(location,_hh$temp0)||(location=_hh$temp0);}.call(this));',
            },
            {
                src:      'a(location = value)',
                expected: 'a(function() { var _hh$temp0 = value; return __set$Loc(location, _hh$temp0) || (location = _hh$temp0); }.call(this))',
            },
            {
                src:      'obj.location = obj.location = obj.location',
                expected: '__set$(obj,"location",__set$(obj,"location",__get$(obj,"location")))',
            },
            {
                src:      'temp = { location: value, value: location }',
                expected: 'temp = { location: value, value: __get$Loc(location) }',
            },

            { src: '--location', expected: '--location' },
            { src: 'location--', expected: 'location--' },
            { src: 'location++', expected: 'location++' },
            { src: '++location', expected: '++location' },

            {
                src:      'location+=value',
                expected: '0,function(){ var _hh$temp0 = __get$Loc(location)+value; return __set$Loc(location,_hh$temp0)||' +
                          '(location=_hh$temp0);}.call(this)',
            },
            {
                src:      'location+=location+value',
                expected: '0,function(){var _hh$temp0 = __get$Loc(location)+(__get$Loc(location)+value); return __set$Loc(location,_hh$temp0)||' +
                          '(location=_hh$temp0);}.call(this)',
            },
            {
                src:      'location.href+=value',
                expected: '__set$(__get$Loc(location), "href", __get$(__get$Loc(location), "href") + value)',
            },
            {
                src:      'location["href"]+=value',
                expected: '__set$(__get$Loc(location), "href", __get$(__get$Loc(location), "href") + value) ',
            },
            {
                src: 'location-=value;location*=value;location/=value;' +
                     'location>>=value;location<<=value;location>>>=value;' +
                     'location&=value;location|=value;location^=value',

                expected: 'location-=value;location*=value;location/=value;' +
                          'location>>=value;location<<=value;location>>>=value;' +
                          'location&=value;location|=value;location^=value',
            },
            {
                src: 'new function(a){location=str,a.click();}();',

                expected: 'new function(a) {(0,function(){var _hh$temp0 = str; return __set$Loc(location,_hh$temp0)||' +
                          '(location=_hh$temp0);}.call(this)), a.click();}();',
            },
            {
                src: 'b.onerror = b.onload = function (a) { location = a; };',

                expected: 'b.onerror = b.onload = function(a){' +
                          '0,function(){var _hh$temp0 = a; return__set$Loc(location,_hh$temp0)||(location=_hh$temp0);}.call(this);};',
            },
            {
                src: 'location = newLocation, x = 5;',

                expected: '0,function(){var _hh$temp0 = newLocation; return __set$Loc(location,_hh$temp0)||(location=_hh$temp0);}.call(this), x = 5;',
            },
            {
                src: 'x = 5, location = newLocation;',

                expected: 'x = 5, function(){var _hh$temp0 = newLocation; return __set$Loc(location,_hh$temp0)||(location=_hh$temp0);}.call(this);',
            },
            {
                src: 'location ? location = newLocation : location = "#123";',

                expected: '__get$Loc(location)' +
                          '? function(){var _hh$temp0 = newLocation; return __set$Loc(location,_hh$temp0)||(location=_hh$temp0);}.call(this)' +
                          ': function(){var _hh$temp1 = "#123"; return __set$Loc(location,_hh$temp1)||(location=_hh$temp1);}.call(this);',
            },
            {
                src: 'if (location) { location = newLocation; } else location = "#123";',

                expected: 'if (__get$Loc(location)) {' +
                          '0,function(){var _hh$temp0 = newLocation; return __set$Loc(location,_hh$temp0)||(location=_hh$temp0);}.call(this);}' +
                          'else 0,function(){var _hh$temp1 = "#123"; return __set$Loc(location,_hh$temp1)||(location=_hh$temp1);}.call(this);',
            },
            {
                src:      'var obj = { location: function location() {} }',
                expected: 'var obj = { location: function location() {} }',
            },
            {
                src:      'function location(){}',
                expected: 'function location(){}',
            },
            {
                src:      'class location{x(){}}',
                expected: 'class location{x(){}}',
            },
            {
                src:      'class x{location(){}}',
                expected: 'class x{location(){}}',
            },
            {
                src:      'y=location=>{}',
                expected: 'y=location=>{}',
            },
            {
                src:      'y=(...location)=>{}',
                expected: 'y=(...location)=>{}',
            },
            {
                src:      'x[y]=(location=8)=>{}',
                expected: '__set$(x,y,(location=8)=>{})',
            },
            {
                src:      'function x(param=location){}',
                expected: 'function x(param=__get$Loc(location)){}',
            },
            {
                // NOTE: The fn function must be called once
                src:      'location = fn();',
                expected: '0,function(){var _hh$temp0 = fn(); return __set$Loc(location,_hh$temp0)||(location=_hh$temp0);}.call(this);',
            },
            {
                src:      'var a, b\na = b\nlocation = "#123"',
                expected: 'var a, b\na = b\n0,function(){var _hh$temp0="#123";return __set$Loc(location,_hh$temp0)||(location=_hh$temp0);}.call(this)',
            },
        ]);
    });

    it('Should expand concat operator only if necessary', () => {
        testProcessing([
            { src: 'prop += 1', expected: 'prop += 1' },
            { src: 'prop += 2 + prop + 1', expected: 'prop += 2 + prop + 1' },
            { src: '(a = b) += c', expected: '(a = b) += c' },
            { src: 'prop.href += 1', expected: '__set$(prop,"href",__get$(prop,"href")+1)' },
            { src: 'for (f = 5; f; ) c[--f] += t[f]', expected: 'for (f = 5; f; ) c[--f] += __get$(t,f)' },
            {
                src:      'prop.location += 2 + prop.location + 1',
                expected: '__set$(prop,"location",__get$(prop,"location")+(2 + __get$(prop,"location") + 1 ))',
            },
        ]);
    });

    it('Should add a space before the replacement string', () => {
        const processed = processScript('if(true){;}else"0"[s]', false);

        expect(processed).eql('if(true){;}else __get$("0",s) ');
    });

    it('Should process a "new" expression if its body contains processed nodes', () => {
        testPropertyProcessing([
            { src: 'new a.{0}.b()', expected: 'new (__get$(a,"{0}")).b()' },
            {
                src:      'new function() { a.{0};a.{0};}();',
                expected: 'new function() {__get$(a,"{0}");__get$(a,"{0}");}();',
            },
            {
                src:      'new (function() { eval("");a.{0};})();',
                expected: 'new function() {eval(__proc$Script(""));__get$(a,"{0}");}();',
            },
            {
                src:      'new a(function() { b.{0}; new ok(b.{0}); })',
                expected: 'new a(function() { __get$(b,"{0}"); new ok(__get$(b,"{0}")); })',
            },
            { src: 'new a.{0}.b(c.{0})', expected: 'new (__get$(a,"{0}")).b(__get$(c,"{0}"))' },
            { src: 'func(new a.{0}.func())', expected: 'func(new (__get$(a,"{0}")).func())' },
        ]);
    });

    it('Should process properties', () => {
        testPropertyProcessing([
            { src: 'switch(s){case a.{0}:b.{0}}', expected: 'switch(s){case __get$(a,"{0}"): __get$(b,"{0}")}' },
            { src: 'function {0}(){}', expected: 'function {0}(){}' },
            { src: 'obj.{0}', expected: '__get$(obj, "{0}")' },
            { src: 'obj.{0} = value', expected: '__set$(obj, "{0}", value)' },
            { src: 'obj.{0}.subProp', expected: '__get$(obj, "{0}").subProp' },
            { src: 'obj.{0}.{0} = value', expected: '__set$(__get$(obj, "{0}"),"{0}", value)' },
            { src: 'delete obj.{0}', expected: 'delete obj.{0}' },
            { src: 'obj.{0}.method()', expected: '__get$(obj, "{0}").method()' },
            { src: 'new (obj.{0})()', expected: 'new (obj.{0})()' },
            { src: '--obj.{0}', expected: '--obj.{0}' },
            { src: 'obj.{0}--', expected: 'obj.{0}--' },
            { src: 'obj.{0}++', expected: 'obj.{0}++' },
            { src: '++obj.{0}', expected: '++obj.{0}' },
            { src: 'obj.{0}()', expected: 'obj.{0}()' },

            { src: 'obj.{0}+=value', expected: '__set$(obj, "{0}", __get$(obj, "{0}")+value)' },
            {
                src:      'obj.{0}+=obj.{0}+value',
                expected: '__set$(obj,"{0}",__get$(obj, "{0}")+(__get$(obj, "{0}")+value))',
            },
            { src: 'obj.{0}.field+=value', expected: '__get$(obj,"{0}").field +=value' },
            {
                src:      'obj.{0}[field]+=value',
                expected: '__set$(__get$(obj,"{0}"),field,__get$(__get$(obj,"{0}"), field) + value)',
            },
            {
                src:      'obj.{0}["field"]+=value',
                expected: '__get$(obj,"{0}")["field"]+=value',
            },
            {
                src:      'obj.{0}["href"]+=value',
                expected: '__set$(__get$(obj,"{0}"),"href", __get$(__get$(obj,"{0}"), "href") + value)',
            },
            { src: 'result = $el[0].{0}', expected: 'result = __get$($el[0], "{0}")' },
            { src: 'obj.{0} = value, obj1 = value', expected: '__set$(obj,"{0}",value), obj1 = value' },
            { src: '{}script.{0} += ""', expected: '{} __set$(script, "{0}", __get$(script,"{0}")+"")' },

            {
                src: 'obj.{0}-=value;obj.{0}*=value;obj.{0}/=value;' +
                     'obj.{0}>>=value;obj.{0}<<=value;obj.{0}>>>=value;' +
                     'obj.{0}&=value;obj.{0}|=value;obj.{0}^=value',

                expected: 'obj.{0}-=value;obj.{0}*=value;obj.{0}/=value;' +
                          'obj.{0}>>=value;obj.{0}<<=value;obj.{0}>>>=value;' +
                          'obj.{0}&=value;obj.{0}|=value;obj.{0}^=value',
            },
            { src: 'obj.{0};let p = ""', expected: '__get$(obj, "{0}"); let p = ""' },
            {
                src:      'class x extends y{method(){return super.{0};}}',
                expected: 'class x extends y{method(){return super.{0};}}',
            },
            {
                src:      'class x extends y{method(){return super.{0} = value;}}',
                expected: 'class x extends y{method(){return super.{0} = value;}}',
            },
        ]);
    });

    it('Should process computed properties', () => {
        testPropertyProcessing([
            { src: 'var temp = "location"; obj[t]', expected: 'var temp = "location";__get$(obj, t)' },
            {
                src:      'obj[prop1]["prop2"].{0}.{0} = value',
                expected: '__set$(__get$(__get$(obj, prop1)["prop2"], "{0}"),"{0}", value)',
            },
            { src: 'obj[someProperty] = value', expected: '__set$(obj, someProperty, value)' },
            { src: 'delete obj[{0}]', expected: 'delete obj[{0}]' },
            { src: 'new (obj["{0}"])()', expected: 'new (obj["{0}"])()' },

            { src: '--obj[{0}]', expected: '--obj[{0}]' },
            { src: 'obj[{0}]--', expected: 'obj[{0}]--' },
            { src: 'obj[0]++', expected: 'obj[0]++' },
            { src: '++obj[0]', expected: '++obj[0]' },
            { src: 'obj[someProperty](1,2,3)', expected: '__call$(obj,someProperty,[1,2,3])' },

            {
                src: 'obj[{0}]-=value;obj[{0}]*=value;obj[{0}]/=value;' +
                     'obj[{0}]>>=value;obj[{0}]<<=value;obj[{0}]>>>=value;' +
                     'obj[{0}]&=value;obj[{0}]|=value;obj[{0}]^=value',

                expected: 'obj[{0}]-=value;obj[{0}]*=value;obj[{0}]/=value;' +
                          'obj[{0}]>>=value;obj[{0}]<<=value;obj[{0}]>>>=value;' +
                          'obj[{0}]&=value;obj[{0}]|=value;obj[{0}]^=value',
            },
            {
                src:      'class x extends y{method(){return super[{0}];}}',
                expected: 'class x extends y{method(){return super[{0}];}}',
            },
            {
                src:      'class x extends y{method(){return super[{0}] = value;}}',
                expected: 'class x extends y{method(){return super[{0}] = value;}}',
            },
        ]);
    });

    it('Should process object expressions', () => {
        testProcessing({
            src:      '{ location: value, value: location, src: src }',
            expected: '{ location: value, value: __get$Loc(location), src: src }',
        });
    });

    it('Should keep raw literals', () => {
        testProcessing({
            src:      'obj["\\u003c/script>"]=location',
            expected: 'obj["\\u003c/script>"]=__get$Loc(location)',
            msg:      ESOTOPE_RAW_LITERAL_PATCH_WARNING,
        });
    });

    it('Should process eval()', () => {
        testProcessing([
            { src: 'eval(script)', expected: 'eval(__proc$Script(script))' },
            { src: 'eval("script")', expected: 'eval(__proc$Script("script"))' },
            { src: 'window.eval(script)', expected: 'window.eval(__proc$Script(script))' },
            { src: 'window["eval"](script)', expected: 'window["eval"](__proc$Script(script))' },

            { src: 'eval.call(window, script)', expected: 'eval.call(window, __proc$Script(script))' },
            { src: 'eval.call(window, "script")', expected: 'eval.call(window, __proc$Script("script"))' },
            { src: 'window.eval.call(window, script)', expected: 'window.eval.call(window, __proc$Script(script))' },
            {
                src:      'window["eval"].call(window, script)',
                expected: 'window["eval"].call(window, __proc$Script(script))',
            },

            { src: 'eval.apply(window, [script])', expected: 'eval.apply(window, __proc$Script([script], true))' },
            { src: 'eval.apply(window, ["script"])', expected: 'eval.apply(window, __proc$Script(["script"], true))' },
            { src: 'eval.apply(window, args)', expected: 'eval.apply(window, __proc$Script(args, true))' },
            {
                src:      'window.eval.apply(window, [script])',
                expected: 'window.eval.apply(window, __proc$Script([script], true))',
            },
            {
                src:      'window["eval"].apply(window, [script])',
                expected: 'window["eval"].apply(window, __proc$Script([script], true))',
            },
            {
                src:      'var w = a.eval ? a.eval.bind(a) : function() {}',
                expected: 'var w = __get$Eval(a.eval) ? __get$Eval(a.eval).bind(a) : function() {}',
            },
            {
                src:      'var w = eval ? eval.bind(window) : function() {}',
                expected: 'var w = __get$Eval(eval) ? __get$Eval(eval).bind(window) : function() {}',
            },
            {
                src:      'var w = win["eval"] ? win["eval"].bind(win) : function() {}',
                expected: 'var w = __get$Eval(win["eval"]) ? __get$Eval(win["eval"]).bind(win) : function() {}',
            },
            {
                src:      'var a = eval, b = window.eval, c = window["eval"];',
                expected: 'var a = __get$Eval(eval), b = __get$Eval(window.eval), c = __get$Eval(window["eval"]);',
            },
            {
                src:      'a = eval, b = window.eval, c = window["eval"];',
                expected: 'a = __get$Eval(eval), b = __get$Eval(window.eval), c = __get$Eval(window["eval"]);',
            },
            {
                src:      '{a: eval, b:window.eval, c: window["eval"]}',
                expected: '{a: __get$Eval(eval), b:__get$Eval(window.eval), c: __get$Eval(window["eval"])}',
            },
            {
                src:      '(function() {return eval;}, function(){return window.eval;}, function(){return window["eval"]})',
                expected: '(function() {return __get$Eval(eval);}, function(){return __get$Eval(window.eval);}, function(){return __get$Eval(window["eval"])})',
            },
            {
                src:      '(function a (eval) {}); a(eval, window.eval, window["eval"]);',
                expected: '(function a (eval) {}); a(__get$Eval(eval), __get$Eval(window.eval), __get$Eval(window["eval"]));',
            },
            {
                src:      '__get$Eval(eval)("");__get$Eval(window.eval)("");__get$Eval(window["eval"])("");',
                expected: '__get$Eval(eval)("");__get$Eval(window.eval)("");__get$Eval(window["eval"])("");',
            },
            {
                src:      'eval++; eval--; ++eval; --eval;',
                expected: 'eval++; eval--; ++eval; --eval;',
            },
            {
                src:      'window.eval = 1; window["eval"] = 1;',
                expected: 'window.eval = 1; window["eval"] = 1;',
            },
            {
                src:      'var ob = {eval : 1};',
                expected: 'var ob = {eval : 1};',
            },

            {
                src:      'var eval = value; eval = newValue;',
                expected: 'var eval = value; eval = newValue;',
            },
            {
                src:      'window.eval.property',
                expected: 'window.eval.property',
            },
            {
                src:      'class X { eval () {} }',
                expected: 'class X { eval () {} }',
            },
            {
                src:      'class eval { x () {} }',
                expected: 'class eval { x () {} }',
            },
            {
                src:      'var obj = { eval: function eval() {} }',
                expected: 'var obj = { eval: function eval() {} }',
            },
            {
                src:      'function eval(){}',
                expected: 'function eval(){}',
            },
            {
                src:      'y=eval=>{}',
                expected: 'y=eval=>{}',
            },
            {
                src:      'y=(...eval)=>{}',
                expected: 'y=(...eval)=>{}',
            },
            {
                src:      'x[y]=(eval=8)=>{}',
                expected: '__set$(x,y,(eval=8)=>{})',
            },
            {
                src:      'function x(param=eval){}',
                expected: 'function x(param=__get$Eval(eval)){}',
            },
        ]);
    });

    it('Should process postMessage', () => {
        testProcessing([
            { src: 'window.postMessage("", "")', expected: '__call$(window, "postMessage", ["", ""])' },
            { src: 'window["postMessage"]("", "")', expected: '__call$(window, "postMessage", ["", ""])' },
            { src: 'window[postMessage]("", "")', expected: '__call$(window, postMessage, ["", ""])' },
            { src: 'some.postMessage("", "")', expected: '__call$(some, "postMessage", ["", ""])' },
            { src: 'window["some"]("", "")', expected: 'window["some"]("", "")' },
            { src: 'window.some.("", "")', expected: 'window.some.("", "")' },

            {
                src:      'postMessage.call(window, "", location)',
                expected: '__get$PostMessage(null, postMessage).call(window, "", __get$Loc(location))',
            },
            {
                src:      'window["postMessage"].call(window, "", "")',
                expected: '__get$PostMessage(window).call(window, "", "")',
            },
            {
                src:      'postMessage.apply(some, ["", ""])',
                expected: '__get$PostMessage(null, postMessage).apply(some, ["", ""])',
            },
            {
                src:      'postMessage.apply(window, args)',
                expected: '__get$PostMessage(null, postMessage).apply(window, args)',
            },
            {
                src:      'some.postMessage.apply(window, ["", ""])',
                expected: '__get$PostMessage(some).apply(window, ["", ""])',
            },
            {
                src:      'var w = a.postMessage ? a.postMessage.bind(a) : function() {}',
                expected: 'var w = __get$PostMessage(a) ? __get$PostMessage(a).bind(a) : function() {}',
            },
            {
                src:      'some.win["postMessage"].apply(window, ["", ""])',
                expected: '__get$PostMessage(some.win).apply(window, ["", ""])',
            },
            {
                src:      'window["postMessage"].apply(window, ["", location])',
                expected: '__get$PostMessage(window).apply(window, ["", __get$Loc(location)])',
            },
            { src: 'postMessage.some(window, ["", ""])', expected: 'postMessage.some(window, ["", ""])' },
            {
                src:      'window["postMessage"].some(window, ["", ""])',
                expected: 'window["postMessage"].some(window, ["", ""])',
            },

            { src: 'postMessage("", "")', expected: '__get$PostMessage(null, postMessage)("", "")' },
            {
                src:      'var a = postMessage, b = window.postMessage, c = window["postMessage"];',
                expected: 'var a = __get$PostMessage(null, postMessage), b = __get$PostMessage(window), c = __get$PostMessage(window);',
            },
            {
                src:      'a = postMessage, b = window.postMessage, c = window["postMessage"];',
                expected: 'a = __get$PostMessage(null, postMessage), b = __get$PostMessage(window), c = __get$PostMessage(window);',
            },
            {
                src:      '{a: postMessage, b:window.postMessage, c: window["postMessage"]}',
                expected: '{a: __get$PostMessage(null, postMessage), b:__get$PostMessage(window), c: __get$PostMessage(window)}',
            },
            {
                src:      '(function() {return postMessage;}, function(){return window.postMessage;}, function(){return window["postMessage"]})',
                expected: '(function() {return __get$PostMessage(null, postMessage);}, function(){return __get$PostMessage(window);}, function(){return __get$PostMessage(window)})',
            },
            {
                src:      '(function a (postMessage) {}); a(postMessage, window.postMessage, window["postMessage"]);',
                expected: '(function a (postMessage) {}); a(__get$PostMessage(null, postMessage), __get$PostMessage(window), __get$PostMessage(window));',
            },
            {
                src:      '__get$PostMessage(postMessage)("");__get$PostMessage(window)("");__get$PostMessage(window)("");',
                expected: '__get$PostMessage(postMessage)("");__get$PostMessage(window)("");__get$PostMessage(window)("");',
            },
            {
                src:      'postMessage++; postMessage--; ++postMessage; --postMessage;',
                expected: 'postMessage++; postMessage--; ++postMessage; --postMessage;',
            },
            {
                src:      'window.postMessage = 1; window["postMessage"] = 1;',
                expected: 'window.postMessage = 1; window["postMessage"] = 1;',
            },
            {
                src:      'var ob = {postMessage : 1};',
                expected: 'var ob = {postMessage : 1};',
            },

            {
                src:      'var postMessage = value; postMessage = newValue;',
                expected: 'var postMessage = value; postMessage = newValue;',
            },
            {
                src:      'window.postMessage.property',
                expected: 'window.postMessage.property',
            },
            {
                src:      'class X { postMessage () {} }',
                expected: 'class X { postMessage () {} }',
            },
            {
                src:      'class postMessage { x () {} }',
                expected: 'class postMessage { x () {} }',
            },
            {
                src:      'var obj = { postMessage: function postMessage() {} }',
                expected: 'var obj = { postMessage: function postMessage() {} }',
            },
            {
                src:      'function postMessage(){}',
                expected: 'function postMessage(){}',
            },
            {
                src:      'y=postMessage=>{}',
                expected: 'y=postMessage=>{}',
            },
            {
                src:      'y=(...postMessage)=>{}',
                expected: 'y=(...postMessage)=>{}',
            },
            {
                src:      'x[y]=(postMessage=8)=>{}',
                expected: '__set$(x,y,(postMessage=8)=>{})',
            },
            {
                src:      'function x(param=postMessage){}',
                expected: 'function x(param=__get$PostMessage(null,postMessage)){}',
            },
        ]);
    });

    it('Should process for..in iteration', () => {
        testProcessing([
            { src: 'for(obj.prop in src){}', expected: 'for(var _hh$temp0 in src){obj.prop = _hh$temp0;}' },
            { src: 'for(obj["prop"] in src){}', expected: 'for(var _hh$temp0 in src){obj["prop"] = _hh$temp0;}' },
            { src: 'for(obj[i++] in src){}', expected: 'for(var _hh$temp0 in src){__set$(obj, i++, _hh$temp0);}' },
            { src: 'for(obj.href in src){}', expected: 'for(var _hh$temp0 in src){__set$(obj, "href", _hh$temp0);}' },
            {
                src:      'for(obj["href"] in src){}',
                expected: 'for(var _hh$temp0 in src){__set$(obj, "href", _hh$temp0);}',
            },
            {
                src:      'for(obj[prop] in src)obj[prop]=123;',
                expected: 'for(var _hh$temp0 in src){__set$(obj, prop, _hh$temp0);__set$(obj, prop, 123);}',
            },
            {
                src:      'for(obj[prop] in src);',
                expected: 'for(var _hh$temp0 in src){__set$(obj, prop, _hh$temp0);;}',
            },
            {
                src: 'for(obj[prop] in some)' +
                     '    for (win[prop] in src)' +
                     '        ;',

                expected: 'for(var _hh$temp0 in some) {' +
                          '    __set$(obj, prop, _hh$temp0);' +
                          '    for(var _hh$temp1 in src) {' +
                          '        __set$(win, prop, _hh$temp1);' +
                          '        ;' +
                          '    }' +
                          '}',
            },
        ]);
    });

    it('Should keep unicode identifiers', () => {
        testProcessing({
            src:      '({\\u00c0:"value"})[value]',
            expected: '__get$({\\u00c0:"value"}, value)',
            msg:      ACORN_UNICODE_PATCH_WARNING,
        });
    });

    it('Should allow ES6 syntax in strict mode', () => {
        testProcessing([
            {
                src:      '"use strict";var let=0;obj[i];',
                expected: '"use strict";var let=0;__get$(obj,i);',
                msg:      ACORN_STRICT_MODE_PATCH_WARNING,
            },
            {
                src:      '"use strict";var obj={yield:function(){}};obj[i];',
                expected: '"use strict";var obj={yield:function(){}};__get$(obj, i);',
                msg:      ACORN_STRICT_MODE_PATCH_WARNING,
            },
        ]);
    });

    it('Should ignore HTML comments', () => {
        testProcessing([
            { src: 'a[i];\n<!-- comment -->', expected: '__get$(a, i);' },
            { src: '<!-- comment -->\n a[i];', expected: '__get$(a, i);' },
            { src: ' <!-- comment -->\n a[i];', expected: '__get$(a, i);' },
            { src: '\n<!-- comment -->\n a[i];', expected: '__get$(a, i);' },
            { src: '<!-- comment1 -->\n<!-- comment2 -->\n a[i];', expected: '__get$(a, i);' },
            { src: '<!-- comment1 -->\n a[i];\n<!-- comment2 -->', expected: '__get$(a, i);' },
            {
                src:      'var t = "<!-- comment1 -->\\n";\na[i];',
                expected: 'var t = "<!-- comment1 -->\\n";\n__get$(a, i);',
            },
        ]);
    });

    it('Should process `import`', () => {
        testProcessing([
            {
                src:      'import * as name from "module-name"',
                expected: 'import * as name from "http://localhost:3000/ksadjo23/http://example.com/module-name"',
            },
            {
                src:      'import("/module-name.js").then(module => {})',
                expected: 'import(__get$ProxyUrl("/module-name.js", "http://example.com/")).then(module => {})',
            },
            {
                src:      'import(moduleName).then(module => {})',
                expected: 'import(__get$ProxyUrl(moduleName, "http://example.com/")).then(module => {})',
            },
            {
                src:      'import(location + "file-name").then(module => {})',
                expected: 'import(__get$ProxyUrl(__get$Loc(location) + "file-name", "http://example.com/")).then(module => {})',
            },
            {
                src:      'export * from "module-name"',
                expected: 'export * from "http://localhost:3000/ksadjo23/http://example.com/module-name"',
            },
            {
                src:      'export { x as y } from "module-name"',
                expected: 'export { x as y } from "http://localhost:3000/ksadjo23/http://example.com/module-name"',
            },
        ]);
    });

    it('Should process optional chaining', () => {
        testPropertyProcessing([
            {
                src:      'obj?.{0}',
                expected: '__get$(obj,"{0}",true)',
            },
            {
                src:      'obj?.["{0}"]',
                expected: '__get$(obj,"{0}",true)',
            },
            {
                src:      'obj?.{0}?.{0}',
                expected: '__get$(__get$(obj,"{0}",true),"{0}",true)',
            },
            {
                src:      'arr?.[0]',
                expected: 'arr?.[0]',
            },
            {
                src:      'obj?.{0}?.method(args)',
                expected: '__get$(obj,"{0}",true)?.method(args)',
            },
            {
                src:      'obj?.{0}.{0}',
                expected: '__get$(__get$(obj,"{0}",true),"{0}",true)',
            },
        ]);

        testMethodProcessing([
            {
                src:      'obj.{0}?.()',
                expected: '__call$(obj,"{0}",[],true)',
            },
            {
                src:      'obj.[0]?.()',
                expected: 'obj.[0]?.()',
            },
        ]);
    });

    describe('Destructuring', () => {
        it('object pattern declaration', () => {
            testProcessing([
                {
                    src:      'var { location, href } = some;',
                    expected: 'var _hh$temp0 = some,' +
                              '    location = __get$(_hh$temp0, "location"),' +
                              '    href = __get$(_hh$temp0, "href");',
                },
            ]);
        });

        it('object pattern assignment', () => {
            testProcessing([
                {
                    src:      '({ location, href } = some);',
                    expected: 'var _hh$temp0;' +
                              '(_hh$temp0 = some,' +
                              ' function() {' +
                              '     var _hh$temp1 = _hh$temp0.location;' +
                              '     return __set$Loc(location, _hh$temp1) || (location = _hh$temp1);' +
                              ' }.call(this),' +
                              ' href = __get$(_hh$temp0, "href"),' +
                              ' _hh$temp0);',
                },
            ]);
        });

        it('object pattern declaration with rest argument', () => {
            testProcessing([
                {
                    src:      'var { a, b: y, ...c } = obj;',
                    expected: 'var _hh$temp0 = obj,' +
                              '    a = _hh$temp0.a,' +
                              '    y = _hh$temp0.b,' +
                              '    c = __rest$Object(_hh$temp0, ["a", "b"]);',
                },
            ]);
        });

        it('object pattern declaration with default argument and nested destructuring', () => {
            testProcessing([
                {
                    src:      'var {x: [y] = z} = some;',
                    expected: 'var _hh$temp0 = some,' +
                              '    _hh$temp0$x = _hh$temp0.x,' +
                              '    _hh$temp0$x$assign = __arrayFrom$(_hh$temp0$x === void 0 ? z : _hh$temp0$x),' +
                              '    y = _hh$temp0$x$assign[0];',
                },
            ]);
        });

        it('array pattern assignment with rest argument and nested destructuring', () => {
            testProcessing([
                {
                    src: 'if (a === b) {' +
                         '    [{ location }, ...args] = [window, i, j];' +
                         '}',

                    expected: 'if (a === b) {' +
                              '    var _hh$temp0, _hh$temp0$i0;' +
                              '    _hh$temp0 = [window,i,j],' +
                              '    _hh$temp0$i0 = _hh$temp0[0],' +
                              '    function() {' +
                              '        var _hh$temp1 = _hh$temp0$i0.location;' +
                              '        return __set$Loc(location, _hh$temp1) || (location = _hh$temp1);' +
                              '    }.call(this),' +
                              '    args = __rest$Array(_hh$temp0, 1),' +
                              '    _hh$temp0;' +
                              '}',
                },
            ]);
        });

        it('object pattern declaration with difficult names', () => {
            testProcessing([
                {
                    src:      'var { [`str${a}`]: item1, [x]: item2, [obj.k]: item3 } = some;',
                    expected: 'var _hh$temp0 = some,' +
                              '    item1 = __get$(_hh$temp0, `str${a}`),' +
                              '    item2 = __get$(_hh$temp0, x),' +
                              '    item3 = __get$(_hh$temp0, obj.k);',
                },
            ]);
        });

        it('object pattern declaration with difficult names and rest argument', () => {
            testProcessing([
                {
                    src:      'var { [`str${a}`]: item1, [x]: item2, [obj.k]: item3, ...other } = some;',
                    expected: 'var _hh$temp0 = some,' +
                              '    _hh$temp1 = `str${a}`,' +
                              '    _hh$temp2 = obj.k,' +
                              '    item1 = __get$(_hh$temp0, _hh$temp1),' +
                              '    item2 = __get$(_hh$temp0, x),' +
                              '    item3 = __get$(_hh$temp0, _hh$temp2),' +
                              '    other = __rest$Object(_hh$temp0, [_hh$temp1, x, _hh$temp2]);',
                },
            ]);
        });

        it('empty object pattern declaration', () => {
            testProcessing([
                {
                    src:      'const {} = { a: 5 };',
                    expected: 'const _hh$temp0 = { a: 5 };',
                },
            ]);
        });

        it('empty array pattern declaration', () => {
            testProcessing([
                {
                    src:      'let [] = [1, 2];',
                    expected: 'let _hh$temp0 = [1, 2];',
                },
            ]);
        });

        it('swap', () => {
            testProcessing([
                {
                    src:      '[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];',
                    expected: 'var _hh$temp0;' +
                              '_hh$temp0 = [__get$(shuffled, j), __get$(shuffled, i)],' +
                              '__set$(shuffled, i, _hh$temp0[0]),' +
                              '__set$(shuffled, j, _hh$temp0[1]),' +
                              '_hh$temp0;',
                },
            ]);
        });

        it('function declaration parameters', () => {
            testProcessing([
                {
                    src: 'function x ({ a, href }, [c, d] = [1, 2], e = 5) {' +
                         '    func = "body";' +
                         '}',

                    expected: 'function x (_hh$temp0, _hh$temp1 = [1, 2], e = 5) {' +
                              '    var a = _hh$temp0.a,' +
                              '        href = __get$(_hh$temp0, "href"),' +
                              '        _hh$temp2 = __arrayFrom$(_hh$temp1),' +
                              '        c = _hh$temp2[0],' +
                              '        d = _hh$temp2[1];' +
                              '    func = "body";' +
                              '}',
                },
            ]);
        });

        it('function expression parameters', () => {
            testProcessing([
                {
                    src: 'var y = function ({ href } = location) {' +
                         '    func = "body";' +
                         '}',

                    expected: 'var y = function (_hh$temp0 = __get$Loc(location)) {' +
                              '    var href = __get$(_hh$temp0, "href");' +
                              '    func = "body";' +
                              '}',
                },
            ]);
        });

        it('class method parameters', () => {
            testProcessing([
                {
                    src: 'class A {' +
                         '    m ({ href: url } = link, ...args) {' +
                         '        g = 6;' +
                         '    }' +
                         '}',

                    expected: 'class A {' +
                              '    m (_hh$temp0 = link, ...args) {' +
                              '        var url = __get$(_hh$temp0, "href");' +
                              '        g = 6;' +
                              '    }' +
                              '}',
                },
            ]);
        });

        it('arrow function with block statement parameters', () => {
            testProcessing([
                {
                    src:      'links.forEach(({ href, port }, index) => { href = port; });',
                    expected: 'links.forEach((_hh$temp0, index) => {' +
                              '    var href = __get$(_hh$temp0, "href"),' +
                              '        port = _hh$temp0.port;' +
                              '    href = port;' +
                              '});',
                },
            ]);
        });

        it('arrow function without block statement parameters', () => {
            testProcessing([
                {
                    src:      'links.sort(({ href: href1 }, { href: href2 }) => href2 == href1);',
                    expected: 'links.sort((_hh$temp0, _hh$temp1) => {' +
                              '    var href1 = __get$(_hh$temp0, "href"),' +
                              '        href2 = __get$(_hh$temp1, "href");' +
                              '    return href2 == href1;' +
                              '});',
                },
            ]);
        });

        it('arrow function without block statement parameters that returns object expression', () => {
            testProcessing([
                {
                    src:      'links.forEach(({ href }) => ({ a: href, b: 23 }));',
                    expected: 'links.forEach(_hh$temp0 => {' +
                              '    var href = __get$(_hh$temp0, "href");' +
                              '    return { a: href, b: 23 };' +
                              '});',
                },
            ]);
        });

        it('arrow function without block statement with default parameter', () => {
            testProcessing([
                {
                    src: 'var f = ({ accountSettings: e } = i) => 1 === Number(e.runAsThread)',

                    expected: 'var f = (_hh$temp0 = i) => {' +
                              '    var e = _hh$temp0.accountSettings;' +
                              '    return 1 === Number(e.runAsThread);' +
                              '}',
                },
            ]);
        });

        it('for-of operator', () => {
            testProcessing([
                {
                    src:      'for (let { href, location } of some) ;',
                    expected: 'for (let _hh$temp0 of some) {' +
                              '    let href = __get$(_hh$temp0, "href"),' +
                              '        location = __get$(_hh$temp0, "location");' +
                              '    ;' +
                              '}',
                },
                {
                    src: 'for (const [href, location] of some) {' +
                         '    a = b;' +
                         '}',

                    expected: 'for (const _hh$temp0 of some) {' +
                              '    const _hh$temp1 = __arrayFrom$(_hh$temp0),' +
                              '        href = _hh$temp1[0],' +
                              '        location = _hh$temp1[1];' +
                              '    a = b;' +
                              '}',
                },
                {
                    src: 'for ([href, location] of some) {' +
                         '    h = href;' +
                         '}',

                    expected: 'for (var _hh$temp0 of some) {' +
                              '    var_hh$temp1;' +
                              '    _hh$temp1=__arrayFrom$(_hh$temp0),' +
                              '        href = _hh$temp1[0], function () {' +
                              '            var _hh$temp2 = _hh$temp1[1];' +
                              '            return __set$Loc(location, _hh$temp2) || (location = _hh$temp2);' +
                              '        }.call(this),_hh$temp1;' +
                              '    h = href;' +
                              '}',
                },
                {
                    src: 'for ({ href, location } of some) a = b;',

                    expected: 'for (var _hh$temp0 of some) {' +
                              '    href = __get$(_hh$temp0, "href"), function() {' +
                              '        var _hh$temp1 = _hh$temp0.location;' +
                              '        return __set$Loc(location, _hh$temp1) || (location = _hh$temp1);' +
                              '    }.call(this);' +
                              '    a = b;' +
                              '}',
                },
                {
                    src: 'for (const [,a] of some) {' +
                         '    const b = 123;' +
                         '}',

                    expected: 'for (const _hh$temp0 of some) {' +
                              '    const_hh$temp1 = __arrayFrom$(_hh$temp0),' +
                              '        a = _hh$temp1[1];' +
                              '    const b = 123;' +
                              '}',
                },
            ]);
        });

        it('for-of without space after declaration', () => {
            const src       = 'for (const {location}of some) ;';
            const expected  = 'for (const  _hh$temp0 of some)  {const location=__get$(_hh$temp0,"location");;} ';
            const processed = processScript(src, false, false);
            const msg       = 'Source: ' + src + '\n' +
                              'Result: ' + processed + '\n' +
                              'Expected: ' + expected + '\n';

            expect(processed).eql(expected, msg);
        });

        it('ternary operator', () => {
            testProcessing([
                {
                    src:      'condition ? {x, y} = point : (x = 0, y = 0)',
                    expected: 'var _hh$temp0;' +
                              'condition ? (_hh$temp0 = point, x = _hh$temp0.x, y = _hh$temp0.y, _hh$temp0) : (x = 0, y = 0)',
                },
            ]);
        });

        it('empty function parameter destructuring', () => {
            testProcessing([
                {
                    src:      'function x ({}, []) {}',
                    expected: 'function x ({}, []) {}',
                },
            ]);
        });

        it('multiple destructuring', () => {
            testProcessing([
                {
                    src: 'function k () {' +
                         '    let [a, b] = e;' +
                         '    return [a, b] = e;' +
                         '}',

                    expected: 'function k () {' +
                              '    var _hh$temp1;' +
                              '    let _hh$temp0 = __arrayFrom$(e),' +
                              '        a = _hh$temp0[0],' +
                              '        b = _hh$temp0[1];' +
                              '    return (_hh$temp1 = __arrayFrom$(e), a = _hh$temp1[0], b = _hh$temp1[1], _hh$temp1);' +
                              '}',
                },
            ]);
        });

        it('destructuring and duplicate declaration', () => {
            testProcessing([
                {
                    src: 'for (let [a] of q) { let a = 1; }',

                    expected: 'for (let_hh$temp0 of q) { let_hh$temp2 = __arrayFrom$(_hh$temp0), _hh$temp1 = _hh$temp2[0]; let a = 1;}',
                },
                {
                    src: 'for (let [a, b] of q) { let a = 1; }',

                    expected: 'for (let _hh$temp0 of q) { let_hh$temp2 = __arrayFrom$(_hh$temp0), _hh$temp1 = _hh$temp2[0], b =_hh$temp2[1]; let a = 1;}',
                },
                {
                    src: 'for (let [b, a] of q) { let a = 1; }',

                    expected: 'for (let _hh$temp0 of q) { let_hh$temp2 = __arrayFrom$(_hh$temp0), b = _hh$temp2[0], _hh$temp1 = _hh$temp2[1]; let a = 1;}',
                },
                {
                    src: 'for (let [a, b] of q) { let a = 1; let b = 2; }',

                    expected: 'for (let _hh$temp0 of q) { let_hh$temp3 = __arrayFrom$(_hh$temp0), _hh$temp1 = _hh$temp3[0], _hh$temp2 = _hh$temp3[1]; let a = 1; let b = 2;}',
                },
                {
                    src: 'for (let [a, b] of q) { let a = 1, b = 2; }',

                    expected: 'for (let _hh$temp0 of q) { let_hh$temp3 = __arrayFrom$(_hh$temp0), _hh$temp1 = _hh$temp3[0], _hh$temp2 = _hh$temp3[1]; let a = 1, b = 2;}',
                },
                {
                    src: 'for (let [a] of q) { let [a] = q; }',

                    expected: 'for (let _hh$temp0 of q) { let_hh$temp2 = __arrayFrom$(_hh$temp0), _hh$temp1 = _hh$temp2[0]; let_hh$temp3 = __arrayFrom$(q), a =_hh$temp3[0]; }',
                },
                {
                    src: 'for (let [a] of q) { let { a } = q; }',

                    expected: 'for (let _hh$temp0 of q) { let_hh$temp2 = __arrayFrom$(_hh$temp0), _hh$temp1 = _hh$temp2[0]; let _hh$temp3 = q, a =_hh$temp3.a; }',
                },
                {
                    src: 'for (let [a, b] of q) { let { a, b } = q; }',

                    expected: 'for (let _hh$temp0 of q) { let_hh$temp3 = __arrayFrom$(_hh$temp0), _hh$temp1 = _hh$temp3[0], _hh$temp2 = _hh$temp3[1]; let _hh$temp4 = q, a = _hh$temp4.a, b = _hh$temp4.b; }',
                },
                {
                    src: 'for (let [a] of q) { let { t: a } = q; }',

                    expected: 'for (let _hh$temp0 of q) { let_hh$temp2 = __arrayFrom$(_hh$temp0), _hh$temp1 = _hh$temp2[0]; let _hh$temp3 = q, a = _hh$temp3.t; }',
                },
                // NOTE: we should replace only if body is `BlockStatement`
                {
                    src: 'for (let [a] of q) if (true) { let a = 1; }',

                    expected: 'for (let _hh$temp0 of q) { let_hh$temp1 = __arrayFrom$(_hh$temp0), a = _hh$temp1[0]; if (true) { let a = 1; }}',
                },
                // NOTE: it's ok that we do not replace the `a` variable inside the `console.log` method`
                // since we expect to get the `Cannot access 'a' before initialization` error message
                {
                    src: 'for (let [b, a] of q) { console.log(a); let a = 1; }',

                    expected: 'for (let _hh$temp0 of q) { let_hh$temp2 = __arrayFrom$(_hh$temp0), b = _hh$temp2[0], _hh$temp1 = _hh$temp2[1]; console.log(a); let a = 1;}',
                },
                // NOTE: we should not rename the `for-of left` var if it is redeclared in the deeper statement
                {
                    src: 'for (let [a] of q) { if (true) { let a = 1; } }',

                    expected: 'for (let _hh$temp0 of q) { let_hh$temp1 = __arrayFrom$(_hh$temp0), a = _hh$temp1[0]; if (true) { let a = 1; }}',
                },
                {
                    src: 'for (let [a] of q) { for (let a = 1; a < 5; a++) {} }',

                    expected: 'for (let _hh$temp0 of q) { let_hh$temp1 = __arrayFrom$(_hh$temp0), a = _hh$temp1[0]; for (let a = 1; a < 5; a++) { } }',
                },
            ]);
        });

        it('duplicate destructuring', () => {
            testProcessing([
                {
                    src: 'const { A: { C }, A: { B } } = obj;',

                    expected: 'const _hh$temp0 = obj,' +
                              '    _hh$temp0$A = _hh$temp0.A,' +
                              '    C = _hh$temp0$A.C,' +
                              '    _hh$temp0$A$i1 = _hh$temp0.A,' +
                              '    B = _hh$temp0$A$i1.B;',
                },
            ]);
        });

        it('Should not process destructuring', () => {
            testProcessing([
                {
                    src:      'export { href as location, postMessage, eval as g } from "module";',
                    expected: 'export { href as location, postMessage, eval as g } from "http://localhost:3000/ksadjo23/http://example.com/module";',
                },
                {
                    src:      'import { location, postMessage, eval } from "module";',
                    expected: 'import { location, postMessage, eval } from "http://localhost:3000/ksadjo23/http://example.com/module";',
                },
                {
                    src:      'for (let { location, eval, postMessage } in some);',
                    expected: 'for (let { location, eval, postMessage } in some);',
                },
                {
                    src:      'for ({ eval, location, postMessage } in some);',
                    expected: 'for ({ eval, location, postMessage } in some);',
                },
                {
                    src:      'try { } catch ({ msg, stack, location, eval, postMessage }) {}',
                    expected: 'try { } catch ({ msg, stack, location, eval, postMessage }) {}',
                },
            ]);
        });

        it('destruction with ?? operator (GH-2782)', () => {
            testProcessing([{
                src:      'var { t } = data, r = (n ?? "") || t;',
                expected: 'var_hh$temp0=data,t=_hh$temp0.t,r=(n??"")||t;',
            }]);
        });
    });

    describe('Regression', () => {
        it('Should leave comments unchanged (T170848)', () => {
            testProcessing({
                src:      'function test(){ \n /* \n line1 \n line2 \n line3 \n */ } a[src]=function(){};',
                expected: 'function test(){ \n /* \n line1 \n line2 \n line3 \n */ } __set$(a,src,function(){});',
            });
        });

        it('Should process content in block statement (T209250)', () => {
            testProcessing({
                src:      '{ (function() { a[src] = "success"; })(); }',
                expected: '{ (function() { __set$(a, src, "success"); })(); }',
            });
        });

        it('Should keep script content inside HTML comments (T226589)', () => {
            testProcessing({
                src: 'document.writeln("<!--test123-->");\n' +
                     '<!--Begin -->\n' +
                     '<!--\n' +
                     'client = "42";\n' +
                     '/* yo yo */\n' +
                     'slot = "43";\n' +
                     'width = 300;\n' +
                     'e = eval;\n' +
                     'height = 250;\n' +
                     '//-->\n\n' +
                     '<!--End -->\n' +
                     'document.writeln("var t = 1;");\n' +
                     'document.writeln("t = 2;");\n' +
                     'document.close();\n',

                expected: 'document.writeln("<!--test123-->");' +
                          'client = "42";' +
                          '/* yo yo */\n' +
                          'slot = "43";' +
                          'width = 300;' +
                          'e = __get$Eval(eval);' +
                          'height = 250;' +
                          '//-->\n\n' +
                          'document.writeln("var t = 1;");' +
                          'document.writeln("t = 2;");' +
                          'document.close();',
            });
        });

        it('Should handle malformed HTML comments (T239244)', () => {
            testProcessing({
                src: '<!-- rai_mm_tools -->\n' +
                     '<!--\n' +
                     'function test(theURL,winName,features) { //v2.0\n' +
                     '   a[i];\n' +
                     '}\n' +
                     '//-->',

                expected: 'function test(theURL,winName,features) { //v2.0\n' +
                          '   __get$(a, i);\n' +
                          '}\n' +
                          '//-->',
            });
        });

        it('Should handle malformed closing HTML comments (health monitor)', () => {
            testProcessing([
                {
                    src: '<!--\n' +
                         'dn="SIDEX.RU";\n' +
                         'a[i]\n' +
                         '// -->',

                    expected: 'dn="SIDEX.RU";\n' +
                              '__get$(a, i)\n' +
                              '// -->',
                },
                {
                    src:      '<!--\n' + 'dn="SIDEX.RU";\n // -->',
                    expected: '<!--\n' + 'dn="SIDEX.RU";\n // -->',
                },
            ]);
        });

        it('Should keep line after open HTML comments (health monitor)', () => {
            testProcessing({
                src: '<!--\n' +
                     'var rdm0 = "";\n' +
                     'var rdm1 = "";\n' +
                     'a[i];' +
                     '//-->',

                expected: 'var rdm0 = "";\n' +
                          'var rdm1 = "";\n' +
                          '__get$(a, i);' +
                          '//-->',
            });
        });

        it('Should not throw parser exceptions', () => {
            const testParser = function (scriptStr) {
                scriptStr += '\nx[src]';

                expect(processScript(scriptStr, false).indexOf('x[src]') === -1).equal(true);
            };

            testParser('function a(){function b(){}/k/;}'); // GH-591
            testParser('function s(){do var x = 9; while(false)return}'); // GH-567
            testParser('x[y] = (def = 5, ...args) => {};'); // GH-1336
        });

        it('Should process the content in the conditional function declaration', () => {
            testProcessing({
                src:      'function foo() { if(true) function bar() { obj[src]; } }',
                expected: 'function foo() { if(true) function bar() { __get$(obj, src); } }',
            });
        });

        it('Should process async function (GH-1260)', () => {
            testProcessing([
                {
                    src:      'async function foo() { return await bar(obj[src]); }',
                    expected: 'async function foo() { return await bar(__get$(obj, src)); }',
                },
                {
                    src:      'const foo = new class { async bar() { async function t() {}; var t = async function () {}; return async () => { await t(obj[prop]); }; }}();',
                    expected: 'const foo = new class { async bar() { async function t() {}; var t = async function () {}; return async () => { await t(__get$(obj, prop)); }; }}();',
                },
                {
                    src:      'const y = { async [x] () { await (0); } }[x]', // GH-1862
                    expected: 'const y = __get$({ async [x] () { await 0; } }, x)',
                },
                {
                    src:      'new X(() => {(async () => { b[c] = d; })(); })', // GH-2002
                    expected: 'new X(() => {(async () => { __set$(b, c, d); })(); })',
                },
                {
                    src:      'new X(() => {(async function () { b[c] = d; })(); })', // GH-2002
                    expected: 'new X(() => {(async function () { __set$(b, c, d); }()); })',
                },
                {
                    src:      'd[f]=async function(){await(x={qwe:123},y(x))}', // GH-2072
                    expected: '__set$(d,f,async function(){await (x={qwe:123},y(x));})',
                },
                {
                    src:      'async function f() { result[type] = (await result).clone(); }', // GH-2255
                    expected: 'async function f() {  __set$(result,type,(await result).clone()); }',
                },
                {
                    src:      'async function f() { result[type] = await result.clone(); }', // GH-2255
                    expected: 'async function f() {  __set$(result,type,await result.clone()); }',
                },
            ]);
        });

        it('Should process array with holes without errors', () => {
            testProcessing([
                {
                    src:      'var x = [1, , 3];',
                    expected: 'var x = [1, , 3];',
                },
            ]);
        });

        it('Should correctly format meta property', () => {
            testProcessing([
                {
                    src: 'function x () {' +
                         '    let { a, b } = new.target;' +
                         '}',

                    expected: 'function x () {' +
                              '    let _hh$temp0 = new.target,' +
                              '        a = _hh$temp0.a,' +
                              '        b = _hh$temp0.b;' +
                              '}',
                },
            ]);
        });

        it('Should not lose parentheses inside the computed property (GH-2442)', () => {
            testProcessing([
                {
                    src: 'Object.assign({}, { [(a, b)]: c } )',

                    expected: '__call$(Object, "assign", [{}, { [(a, b)]: c }])',
                },
            ]);
        });

        it('Should not lose parentheses inside the for..of loop (GH-2573)', () => {
            testProcessing({
                src: 'i[j] = () => {' +
                     '    for (var x of (a, b))' +
                     '        c();' +
                     '}',

                expected: '__set$(i, j, () => {' +
                          '    for (var x of (a, b))' +
                          '        c();' +
                          '})',
            });
        });

        it('Should not lose parentheses around logical expressions inside nullish coalescing', () => {
            testProcessing([
                {
                    src:      'i[s]=n[s]??(a&&a[s])',
                    expected: '__set$(i,s,__get$(n,s)??(a&&__get$(a,s)))',
                },
            ]);
        });

        it('Should not lose the await keyword in "for await...of" loop', () => {
            testProcessing({
                src: 'i[j] = async () => {' +
                     '    for await (let num of asyncIterable)' +
                     '        x += num;' +
                     '};',

                expected: '__set$(i, j, async () => {' +
                          '    for await (let num of asyncIterable)' +
                          '        x += num;' +
                          '});',
            });
        });

        it('Should not lose the optional operator', () => {
            testProcessing([
                {
                    src:      'i[j] = a.b?.c;',
                    expected: '__set$(i, j, a.b?.c);',
                },
                {
                    src:      'i[j] = a.b?.["d"];',
                    expected: '__set$(i, j, a.b?.["d"]);',
                },
                {
                    src:      'i[j] = a.b?.();',
                    expected: '__set$(i, j, (a.b?.()));',
                },
            ]);
        });

        it('Should not lose empty var assignment with destructuring', () => {
            testProcessing([
                {
                    src:      'var n, { q } = e; n();',
                    expected: 'var n,_hh$temp0 = e, q = _hh$temp0.q; n();',
                },
            ]);
        });
    });
});
