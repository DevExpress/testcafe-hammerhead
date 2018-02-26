'use strict';

const expect                          = require('chai').expect;
const multiline                       = require('multiline');
const processScript                   = require('../../lib/processing/script').processScript;
const isScriptProcessed               = require('../../lib/processing/script').isScriptProcessed;
const HEADER                          = require('../../lib/processing/script/header').HEADER;
const SCRIPT_PROCESSING_START_COMMENT = require('../../lib/processing/script/header').SCRIPT_PROCESSING_START_COMMENT;
const INSTRUMENTED_PROPERTIES         = require('../../lib/processing/script/instrumented').PROPERTIES;


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
        const processed = processScript(testCase.src, false);
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
                expected: template.expected.replace(/\{0}/g, propName)
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
                '{ var a = 42; }'
            ]);
        });

        it('Should not add processing header for the data script', () => {
            assertHasHeader(false, [
                '[1, 2, 3]',
                '{ a: 42 }'
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
                expected: '0,function(){return __set$Loc(location,value)||(location=value);}.call(this)'
            },
            {
                src:      '{ location: 123 }',
                expected: '{ location: 123 }'
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
                expected: '__set$(obj, "location", function(){return __set$Loc(location,value)||(location=value);}.call(this));'
            },
            {
                src:      'a(location = value)',
                expected: 'a(function() { return __set$Loc(location, value) || (location = value); }.call(this))'
            },
            {
                src:      'obj.location = obj.location = obj.location',
                expected: '__set$(obj,"location",__set$(obj,"location",__get$(obj,"location")))'
            },
            {
                src:      'temp = { location: value, value: location }',
                expected: 'temp = { location: value, value: __get$Loc(location) }'
            },

            { src: '--location', expected: '--location' },
            { src: 'location--', expected: 'location--' },
            { src: 'location++', expected: 'location++' },
            { src: '++location', expected: '++location' },

            {
                src:      'location+=value',
                expected: '0,function(){return __set$Loc(location,__get$Loc(location)+value)||' +
                          '(location=__get$Loc(location)+value);}.call(this)'
            },
            {
                src:      'location+=location+value',
                expected: '0,function(){return __set$Loc(location,__get$Loc(location)+(__get$Loc(location)+value))||' +
                          '(location=__get$Loc(location)+(__get$Loc(location)+value));}.call(this)'
            },
            {
                src:      'location.href+=value',
                expected: '__set$(__get$Loc(location), "href", __get$(__get$Loc(location), "href") + value)'
            },
            {
                src:      'location["href"]+=value',
                expected: '__set$(__get$Loc(location), "href", __get$(__get$Loc(location), "href") + value) '
            },
            {
                src: 'location-=value;location*=value;location/=value;' +
                     'location>>=value;location<<=value;location>>>=value;' +
                     'location&=value;location|=value;location^=value',

                expected: 'location-=value;location*=value;location/=value;' +
                          'location>>=value;location<<=value;location>>>=value;' +
                          'location&=value;location|=value;location^=value'
            },
            {
                src: 'new function(a){location=str,a.click();}();',

                expected: 'new function(a) {(0,function(){return__set$Loc(location,str)||' +
                          '(location=str);}.call(this)), a.click();}();'
            },
            {
                src: 'b.onerror = b.onload = function (a) { location = a; };',

                expected: '__set$(b,"onerror",__set$(b,"onload",function(a){' +
                          '0,function(){return__set$Loc(location,a)||(location=a);}.call(this);}));'
            },
            {
                src: 'location = newLocation, x = 5;',

                expected: '0,function(){return __set$Loc(location,newLocation)||(location=newLocation);}.call(this), x = 5;'
            },
            {
                src: 'x = 5, location = newLocation;',

                expected: 'x = 5, function(){return __set$Loc(location,newLocation)||(location=newLocation);}.call(this);'
            },
            {
                src: 'location ? location = newLocation : location = "#123";',

                expected: '__get$Loc(location)' +
                          '? function(){return __set$Loc(location,newLocation)||(location=newLocation);}.call(this)' +
                          ': function(){return __set$Loc(location,"#123")||(location="#123");}.call(this);'
            },
            {
                src: 'if (location) { location = newLocation; } else location = "#123";',

                expected: 'if (__get$Loc(location)) {' +
                          '0,function(){return __set$Loc(location,newLocation)||(location=newLocation);}.call(this);}' +
                          'else 0,function(){return __set$Loc(location,"#123")||(location="#123");}.call(this);'
            },
            {
                src:      'var obj = { location: function location() {} }',
                expected: 'var obj = { location: function location() {} }'
            },
            {
                src:      'function location(){}',
                expected: 'function location(){}'
            },
            {
                src:      'class location{x(){}}',
                expected: 'class location{x(){}}'
            },
            {
                src:      'class x{location(){}}',
                expected: 'class x{location(){}}'
            },
            {
                src:      'y=location=>{}',
                expected: 'y=location=>{}'
            },
            {
                src:      'y=(...location)=>{}',
                expected: 'y=(...location)=>{}'
            },
            {
                src:      'x[y]=(location=8)=>{}',
                expected: '__set$(x,y,(location=8)=>{})'
            },
            {
                src:      'function x(param=location){}',
                expected: 'function x(param=__get$Loc(location)){}'
            }
        ]);
    });

    it('Should expand concat operator', () => {
        testProcessing([
            { src: 'prop += 1', expected: 'prop = prop + 1' },
            { src: 'prop += 2 + prop + 1', expected: 'prop = prop + (2 + prop + 1)' }
        ]);
    });

    it('Should add a space before the replacement string', () => {
        const processed = processScript('if(true){;}else"0"[s]', false);

        expect(processed).eql('if(true){;}else __get$("0",s)');
    });

    it('Should process a "new" expression if its body contains processed nodes', () => {
        testPropertyProcessing([
            { src: 'new a.{0}.b()', expected: 'new (__get$(a,"{0}")).b()' },
            {
                src:      'new function() { a.{0};a.{0};}();',
                expected: 'new function() {__get$(a,"{0}");__get$(a,"{0}");}();'
            },
            {
                src:      'new (function() { eval("");a.{0};})();',
                expected: 'new function() {eval(__proc$Script(""));__get$(a,"{0}");}();'
            },
            {
                src:      'new a(function() { b.{0}; new ok(b.{0}); })',
                expected: 'new a(function() { __get$(b,"{0}"); new ok(__get$(b,"{0}")); })'
            },
            { src: 'new a.{0}.b(c.{0})', expected: 'new (__get$(a,"{0}")).b(__get$(c,"{0}"))' },
            { src: 'func(new a.{0}.func())', expected: 'func(new (__get$(a,"{0}")).func())' }
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
                expected: '__set$(obj,"{0}",__get$(obj, "{0}")+(__get$(obj, "{0}")+value))'
            },
            { src: 'obj.{0}.field+=value', expected: '__get$(obj, "{0}").field = __get$(obj, "{0}").field + value' },
            {
                src:      'obj.{0}[field]+=value',
                expected: '__set$(__get$(obj,"{0}"),field,__get$(__get$(obj,"{0}"), field) + value)'
            },
            {
                src:      'obj.{0}["field"]+=value',
                expected: '__get$(obj,"{0}")["field"]=__get$(obj,"{0}")["field"] + value'
            },
            {
                src:      'obj.{0}["href"]+=value',
                expected: '__set$(__get$(obj,"{0}"),"href", __get$(__get$(obj,"{0}"), "href") + value)'
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
                          'obj.{0}&=value;obj.{0}|=value;obj.{0}^=value'
            },
            { src: 'obj.{0};let p = ""', expected: '__get$(obj, "{0}"); let p = ""' },
            {
                src:      'class x extends y{method(){return super.{0};}}',
                expected: 'class x extends y{method(){return super.{0};}}'
            },
            {
                src:      'class x extends y{method(){return super.{0} = value;}}',
                expected: 'class x extends y{method(){return super.{0} = value;}}'
            }
        ]);
    });

    it('Should process computed properties', () => {
        testPropertyProcessing([
            { src: 'var temp = "location"; obj[t]', expected: 'var temp = "location";__get$(obj, t)' },
            {
                src:      'obj[prop1]["prop2"].{0}.{0} = value',
                expected: '__set$(__get$(__get$(obj, prop1)["prop2"], "{0}"),"{0}", value)'
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
                          'obj[{0}]&=value;obj[{0}]|=value;obj[{0}]^=value'
            },
            {
                src:      'class x extends y{method(){return super[{0}];}}',
                expected: 'class x extends y{method(){return super[{0}];}}'
            },
            {
                src:      'class x extends y{method(){return super[{0}] = value;}}',
                expected: 'class x extends y{method(){return super[{0}] = value;}}'
            }
        ]);
    });

    it('Should process object expressions', () => {
        testProcessing({
            src:      '{ location: value, value: location, src: src }',
            expected: '{ location: value, value: __get$Loc(location), src: src }'
        });
    });

    it('Should keep raw literals', () => {
        testProcessing({
            src:      'obj["\\u003c/script>"]=location',
            expected: 'obj["\\u003c/script>"]=__get$Loc(location)',
            msg:      ESOTOPE_RAW_LITERAL_PATCH_WARNING
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
                expected: 'window["eval"].call(window, __proc$Script(script))'
            },

            { src: 'eval.apply(window, [script])', expected: 'eval.apply(window, __proc$Script([script], true))' },
            { src: 'eval.apply(window, ["script"])', expected: 'eval.apply(window, __proc$Script(["script"], true))' },
            { src: 'eval.apply(window, args)', expected: 'eval.apply(window, __proc$Script(args, true))' },
            {
                src:      'window.eval.apply(window, [script])',
                expected: 'window.eval.apply(window, __proc$Script([script], true))'
            },
            {
                src:      'window["eval"].apply(window, [script])',
                expected: 'window["eval"].apply(window, __proc$Script([script], true))'
            },
            {
                src:      'var a = eval, b = window.eval, c = window["eval"];',
                expected: 'var a = __get$Eval(eval), b = __get$Eval(window.eval), c = __get$Eval(window["eval"]);'
            },
            {
                src:      'a = eval, b = window.eval, c = window["eval"];',
                expected: 'a = __get$Eval(eval), b = __get$Eval(window.eval), c = __get$Eval(window["eval"]);'
            },
            {
                src:      '{a: eval, b:window.eval, c: window["eval"]}',
                expected: '{a: __get$Eval(eval), b:__get$Eval(window.eval), c: __get$Eval(window["eval"])}'
            },
            {
                src:      '(function() {return eval;}, function(){return window.eval;}, function(){return window["eval"]})',
                expected: '(function() {return __get$Eval(eval);}, function(){return __get$Eval(window.eval);}, function(){return __get$Eval(window["eval"])})'
            },
            {
                src:      '(function a (eval) {}); a(eval, window.eval, window["eval"]);',
                expected: '(function a (eval) {}); a(__get$Eval(eval), __get$Eval(window.eval), __get$Eval(window["eval"]));'
            },
            {
                src:      '__get$Eval(eval)("");__get$Eval(window.eval)("");__get$Eval(window["eval"])("");',
                expected: '__get$Eval(eval)("");__get$Eval(window.eval)("");__get$Eval(window["eval"])("");'
            },
            {
                src:      'eval++; eval--; ++eval; --eval;',
                expected: 'eval++; eval--; ++eval; --eval;'
            },
            {
                src:      'window.eval = 1; window["eval"] = 1;',
                expected: 'window.eval = 1; window["eval"] = 1;'
            },
            {
                src:      'var ob = {eval : 1};',
                expected: 'var ob = {eval : 1};'
            },

            {
                src:      'var eval = value; eval = newValue;',
                expected: 'var eval = value; eval = newValue;'
            },
            {
                src:      'window.eval.property',
                expected: 'window.eval.property'
            },
            {
                src:      'class X { eval () {} }',
                expected: 'class X { eval () {} }'
            },
            {
                src:      'class eval { x () {} }',
                expected: 'class eval { x () {} }'
            },
            {
                src:      'var obj = { eval: function eval() {} }',
                expected: 'var obj = { eval: function eval() {} }'
            },
            {
                src:      'function eval(){}',
                expected: 'function eval(){}'
            },
            {
                src:      'y=eval=>{}',
                expected: 'y=eval=>{}'
            },
            {
                src:      'y=(...eval)=>{}',
                expected: 'y=(...eval)=>{}'
            },
            {
                src:      'x[y]=(eval=8)=>{}',
                expected: '__set$(x,y,(eval=8)=>{})'
            },
            {
                src:      'function x(param=eval){}',
                expected: 'function x(param=__get$Eval(eval)){}'
            }
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
                expected: '__get$PostMessage(null, postMessage).call(window, "", __get$Loc(location))'
            },
            {
                src:      'window["postMessage"].call(window, "", "")',
                expected: '__get$PostMessage(window).call(window, "", "")'
            },
            {
                src:      'postMessage.apply(some, ["", ""])',
                expected: '__get$PostMessage(null, postMessage).apply(some, ["", ""])'
            },
            {
                src:      'postMessage.apply(window, args)',
                expected: '__get$PostMessage(null, postMessage).apply(window, args)'
            },
            {
                src:      'some.postMessage.apply(window, ["", ""])',
                expected: '__get$PostMessage(some).apply(window, ["", ""])'
            },
            {
                src:      'some.win["postMessage"].apply(window, ["", ""])',
                expected: '__get$PostMessage(some.win).apply(window, ["", ""])'
            },
            {
                src:      'window["postMessage"].apply(window, ["", location])',
                expected: '__get$PostMessage(window).apply(window, ["", __get$Loc(location)])'
            },
            { src: 'postMessage.some(window, ["", ""])', expected: 'postMessage.some(window, ["", ""])' },
            {
                src:      'window["postMessage"].some(window, ["", ""])',
                expected: 'window["postMessage"].some(window, ["", ""])'
            },

            { src: 'postMessage("", "")', expected: '__get$PostMessage(null, postMessage)("", "")' },
            {
                src:      'var a = postMessage, b = window.postMessage, c = window["postMessage"];',
                expected: 'var a = __get$PostMessage(null, postMessage), b = __get$PostMessage(window), c = __get$PostMessage(window);'
            },
            {
                src:      'a = postMessage, b = window.postMessage, c = window["postMessage"];',
                expected: 'a = __get$PostMessage(null, postMessage), b = __get$PostMessage(window), c = __get$PostMessage(window);'
            },
            {
                src:      '{a: postMessage, b:window.postMessage, c: window["postMessage"]}',
                expected: '{a: __get$PostMessage(null, postMessage), b:__get$PostMessage(window), c: __get$PostMessage(window)}'
            },
            {
                src:      '(function() {return postMessage;}, function(){return window.postMessage;}, function(){return window["postMessage"]})',
                expected: '(function() {return __get$PostMessage(null, postMessage);}, function(){return __get$PostMessage(window);}, function(){return __get$PostMessage(window)})'
            },
            {
                src:      '(function a (postMessage) {}); a(postMessage, window.postMessage, window["postMessage"]);',
                expected: '(function a (postMessage) {}); a(__get$PostMessage(null, postMessage), __get$PostMessage(window), __get$PostMessage(window));'
            },
            {
                src:      '__get$PostMessage(postMessage)("");__get$PostMessage(window)("");__get$PostMessage(window)("");',
                expected: '__get$PostMessage(postMessage)("");__get$PostMessage(window)("");__get$PostMessage(window)("");'
            },
            {
                src:      'postMessage++; postMessage--; ++postMessage; --postMessage;',
                expected: 'postMessage++; postMessage--; ++postMessage; --postMessage;'
            },
            {
                src:      'window.postMessage = 1; window["postMessage"] = 1;',
                expected: 'window.postMessage = 1; window["postMessage"] = 1;'
            },
            {
                src:      'var ob = {postMessage : 1};',
                expected: 'var ob = {postMessage : 1};'
            },

            {
                src:      'var postMessage = value; postMessage = newValue;',
                expected: 'var postMessage = value; postMessage = newValue;'
            },
            {
                src:      'window.postMessage.property',
                expected: 'window.postMessage.property'
            },
            {
                src:      'class X { postMessage () {} }',
                expected: 'class X { postMessage () {} }'
            },
            {
                src:      'class postMessage { x () {} }',
                expected: 'class postMessage { x () {} }'
            },
            {
                src:      'var obj = { postMessage: function postMessage() {} }',
                expected: 'var obj = { postMessage: function postMessage() {} }'
            },
            {
                src:      'function postMessage(){}',
                expected: 'function postMessage(){}'
            },
            {
                src:      'y=postMessage=>{}',
                expected: 'y=postMessage=>{}'
            },
            {
                src:      'y=(...postMessage)=>{}',
                expected: 'y=(...postMessage)=>{}'
            },
            {
                src:      'x[y]=(postMessage=8)=>{}',
                expected: '__set$(x,y,(postMessage=8)=>{})'
            },
            {
                src:      'function x(param=postMessage){}',
                expected: 'function x(param=__get$PostMessage(null,postMessage)){}'
            }
        ]);
    });

    it('Should process storages', () => {
        testProcessing([
            {
                src:      'function localStorage(){}; function sessionStorage() {};',
                expected: 'function localStorage(){}; function sessionStorage() {};'
            },
            { src: 'localStorage()', expected: '__get$Storage(localStorage)()' },
            { src: 'window.sessionStorage()', expected: 'window.sessionStorage()' },
            { src: 'window["localStorage"]()', expected: 'window["localStorage"]()' },
            {
                src:      'var a = localStorage, b = window.localStorage, c = window["localStorage"];',
                expected: 'var a = __get$Storage(localStorage), b = __get$(window,"localStorage"), c = __get$(window,"localStorage");'
            },
            {
                src:      'a = sessionStorage, b = window.sessionStorage, c = window["sessionStorage"];',
                expected: 'a = __get$Storage(sessionStorage), b =__get$(window,"sessionStorage"), c =__get$(window,"sessionStorage");'
            },
            {
                src:      '{a: localStorage, b:window.localStorage, c: window["localStorage"]}',
                expected: '{a: __get$Storage(localStorage), b: __get$(window,"localStorage"), c:  __get$(window,"localStorage")}'
            },
            {
                src:      '(function() {return sessionStorage;}, function(){return window.sessionStorage;}, function(){return window["sessionStorage"]})',
                expected: '(function() {return __get$Storage(sessionStorage);}, function(){return __get$(window,"sessionStorage");}, function(){return __get$(window,"sessionStorage")})'
            },
            {
                src:      '(function a (localStorage) {}); a(localStorage, window.localStorage, window["localStorage"]);',
                expected: '(function a (localStorage) {}); a(__get$Storage(localStorage),__get$(window,"localStorage"), __get$(window,"localStorage"));'
            },
            {
                src:      '__get$Storage(sessionStorage).getItem("");__get$(window,"localStorage").getItem("");',
                expected: '__get$Storage(sessionStorage).getItem("");__get$(window,"localStorage").getItem("");'
            },
            {
                src:      'sessionStorage++; sessionStorage--; ++localStorage; --localStorage;',
                expected: 'sessionStorage++; sessionStorage--; ++localStorage; --localStorage;'
            },
            {
                src:      'var ob = {localStorage : 1};',
                expected: 'var ob = {localStorage : 1};'
            },

            {
                src:      'var sessionStorage = value; sessionStorage = newValue;',
                expected: 'var sessionStorage = value; sessionStorage = newValue;'
            },
            {
                src:      'window.localStorage.key; window["localStorage"].key',
                expected: '__get$(window,"localStorage").key;__get$(window,"localStorage").key'
            },
            {
                src:      'var obj = { localStorage: function localStorage() {} }',
                expected: 'var obj = { localStorage: function localStorage() {} }'
            },
            {
                src:      'class localStorage{x(){}}',
                expected: 'class localStorage{x(){}}'
            },
            {
                src:      'class x{localStorage(){}}',
                expected: 'class x{localStorage(){}}'
            },
            {
                src:      'y=localStorage=>{}',
                expected: 'y=localStorage=>{}'
            },
            {
                src:      'y=(...localStorage)=>{}',
                expected: 'y=(...localStorage)=>{}'
            },
            {
                src:      'x[y]=(localStorage=8)=>{}',
                expected: '__set$(x,y,(localStorage=8)=>{})'
            },
            {
                src:      'function x(param=localStorage){}',
                expected: 'function x(param=__get$Storage(localStorage)){}'
            },
            {
                src:      'if (typeof localStorage !== "undefined") {}',
                expected: 'if (typeof localStorage !== "undefined") {}'
            }
        ]);
    });

    it('Should process for..in iteration', () => {
        testProcessing([
            { src: 'for(obj.prop in src){}', expected: 'for(var __set$temp in src){obj.prop = __set$temp;}' },
            { src: 'for(obj["prop"] in src){}', expected: 'for(var __set$temp in src){obj["prop"] = __set$temp;}' },
            { src: 'for(obj[i++] in src){}', expected: 'for(var __set$temp in src){__set$(obj, i++, __set$temp);}' },
            { src: 'for(obj.href in src){}', expected: 'for(var __set$temp in src){__set$(obj, "href", __set$temp);}' },
            {
                src:      'for(obj["href"] in src){}',
                expected: 'for(var __set$temp in src){__set$(obj, "href", __set$temp);}'
            },
            {
                src:      'for(obj[prop] in src)obj[prop]=123;',
                expected: 'for(var __set$temp in src){__set$(obj, prop, __set$temp);__set$(obj, prop, 123);}'
            },
            {
                src:      'for(obj[prop] in src);',
                expected: 'for(var __set$temp in src){__set$(obj, prop, __set$temp);;}'
            }
        ]);
    });

    it('Should keep unicode identifiers', () => {
        testProcessing({
            src:      '({\\u00c0:"value"})[value]',
            expected: '__get$({\\u00c0:"value"}, value)',
            msg:      ACORN_UNICODE_PATCH_WARNING
        });
    });

    it('Should allow ES6 syntax in strict mode', () => {
        testProcessing([
            {
                src:      '"use strict";var let=0;obj[i];',
                expected: '"use strict";var let=0;__get$(obj,i);',
                msg:      ACORN_STRICT_MODE_PATCH_WARNING
            },
            {
                src:      '"use strict";var obj={yield:function(){}};obj[i];',
                expected: '"use strict";var obj={yield:function(){}};__get$(obj, i);',
                msg:      ACORN_STRICT_MODE_PATCH_WARNING
            }
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
                expected: 'var t = "<!-- comment1 -->\\n";\n__get$(a, i);'
            }
        ]);
    });

    describe('Regression', () => {
        it('Should leave comments unchanged (T170848)', () => {
            testProcessing({
                src:      'function test(){ \n /* \n line1 \n line2 \n line3 \n */ } a[src]=function(){};',
                expected: 'function test(){ \n /* \n line1 \n line2 \n line3 \n */ } __set$(a,src,function(){});'
            });
        });

        it('Should process content in block statement (T209250)', () => {
            testProcessing({
                src:      '{ (function() { a[src] = "success"; })(); }',
                expected: '{ (function() { __set$(a, src, "success"); })(); }'
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
                          'document.close();'
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
                          '//-->'
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
                              '// -->'
                },
                {
                    src:      '<!--\n' + 'dn="SIDEX.RU";\n // -->',
                    expected: '<!--\n' + 'dn="SIDEX.RU";\n // -->'
                }
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
                          '//-->'
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
                expected: 'function foo() { if(true) function bar() { __get$(obj, src); } }'
            });
        });

        it('Should process async function (GH-1260)', function () {
            testProcessing({
                src:      'async function foo() {  return await bar(obj[src]); }',
                expected: 'async function foo() {  return await bar(__get$(obj, src)); }'
            });
        });
    });
});
