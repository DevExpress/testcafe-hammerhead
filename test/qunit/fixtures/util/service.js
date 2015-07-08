var Service = Hammerhead.get('./util/service');

module('extend');
test('simple two objects', function () {
    var obj1 = {
        property1: 1,
        property2: 'test',
        property3: function () {
            return 1;
        }
    };

    var obj2 = {
        property4: '123'
    };

    obj1 = Service.extend(obj1, obj2);

    strictEqual(obj1.property1, 1);
    strictEqual(obj1.property2, 'test');
    strictEqual(obj1.property3(), 1);
    strictEqual(obj1.property4, '123');
});

test('several objects', function () {
    var obj1   = { property1: 1 };
    var obj2   = { property2: '2' };
    var obj3   = {
        property3: function () {
            return 3;
        }
    };
    var obj4   = { property4: '4' };
    var result = Service.extend({}, obj1, obj2, obj3, obj4);

    strictEqual(result.property1, obj1.property1);
    strictEqual(result.property2, obj2.property2);
    strictEqual(result.property3(), obj3.property3());
    strictEqual(result.property4, obj4.property4);
});

test('deep coping', function () {
    var obj1 = {
        property1: 1,
        property2: {
            property21: 1,
            property22: {
                property221: 1,
                property222: 2
            }
        }
    };

    var obj2 = {
        property1: 2
    };

    var result = Service.extend(obj1, obj2);

    strictEqual(result.property1, 2);
    strictEqual(result.property2, obj1.property2);
    strictEqual(result.property2.property22.property222, obj1.property2.property22.property222);
});

test('null target', function () {
    var obj2   = { property1: 1 };
    var result = Service.extend(null, obj2);

    strictEqual(result.property1, obj2.property1);
});

test('target is build-in type', function () {
    var obj2   = { property1: 1 };
    var result = Service.extend(123, obj2);

    strictEqual(result.property1, obj2.property1);
    strictEqual(Object.keys(result).length, 1);

    result = Service.extend(function () {
    }, obj2);

    strictEqual(result.property1, obj2.property1);
    strictEqual(Object.keys(result).length, 1);
});
