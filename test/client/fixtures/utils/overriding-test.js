var overriding = hammerhead.utils.overriding;

test('overrideDescriptor', function () {
    var obj = {
        _prop: 'value',
    };

    Object.defineProperty(obj, 'prop', {
        get: function () {
            return this._prop;
        },
        set: void 0,

        configurable: true,
        enumerable:   true,
    });

    overriding.overrideDescriptor(obj, 'prop', {
        getter: function () {
            return 'overridden ' + this._prop;
        },
        setter: void 0,
    });

    const overriddenDescriptor = Object.getOwnPropertyDescriptor(obj, 'prop');

    strictEqual(obj.prop, 'overridden value');
    ok(overriddenDescriptor.configurable);
    ok(overriddenDescriptor.enumerable);
});

test('overrideDescriptor in prototype', function () {
    var prototype = {};

    var obj = {
        _prop: 'value',
    };

    Object.setPrototypeOf(obj, prototype);

    Object.defineProperty(prototype, 'prop', {
        get: function () {
            return this._prop;
        },
        set: void 0,

        configurable: true,
        enumerable:   true,
    });

    overriding.overrideDescriptor(obj, 'prop', {
        getter: function () {
            return 'overridden ' + this._prop;
        },
        setter: void 0,
    });

    strictEqual(obj.prop, 'overridden value');
});
