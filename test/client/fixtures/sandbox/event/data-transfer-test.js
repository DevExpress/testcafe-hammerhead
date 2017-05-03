var DataTransfer = hammerhead.eventSandbox.DataTransfer;

test('DataTransfer interface', function () {
    var dataTransfer = new DataTransfer();

    equal(dataTransfer.dropEffect, 'none');
    equal(dataTransfer.effectAllowed, 'uninitialized');

    // Try to set not allowed values into properties
    dataTransfer.dropEffect    = 'a';
    dataTransfer.effectAllowed = 'b';

    equal(dataTransfer.dropEffect, 'none');
    equal(dataTransfer.effectAllowed, 'uninitialized');

    // Change properties
    dataTransfer.dropEffect    = 'copy';
    dataTransfer.effectAllowed = 'none';

    equal(dataTransfer.dropEffect, 'copy');
    equal(dataTransfer.effectAllowed, 'none');


    equal(dataTransfer.items.length, 0);
    equal(dataTransfer.types.length, 0);
    equal(dataTransfer.files.length, 0);

    // Check the setDragImage function doesn't throw
    dataTransfer.setDragImage();

    throws(function () {
        dataTransfer.getData();
    }, /Failed to execute 'getData' on 'DataTransfer'/);

    equal(dataTransfer.getData('text'), '');

    throws(function () {
        dataTransfer.setData();
    }, /Failed to execute 'setData' on 'DataTransfer'/);

    throws(function () {
        dataTransfer.setData('data');
    }, /Failed to execute 'setData' on 'DataTransfer'/);
});

test('Manage items', function () {
    var dataTransfer = new DataTransfer();

    // Add items
    dataTransfer.setData('text/plain', 'data');
    dataTransfer.setData('text/uri-list', 'http://example.com#abc');

    equal(dataTransfer.items.length, 2);

    var types = dataTransfer.types;

    equal(types.length, 2);
    equal(types[0], 'text/plain');
    equal(types[1], 'text/uri-list');

    equal(dataTransfer.getData('text'), 'data');
    equal(dataTransfer.getData('text/plain'), 'data');
    equal(dataTransfer.getData('url'), 'http://example.com#abc');

    equal(dataTransfer.items[0].kind, 'string');
    equal(dataTransfer.items[0].type, 'text/plain');

    equal(dataTransfer.items[1].kind, 'string');
    equal(dataTransfer.items[1].type, 'text/uri-list');

    throws(function () {
        dataTransfer.items.add();
    }, /Failed to execute 'add' on 'DataTransferItemList'/);

    throws(function () {
        dataTransfer.items.add('data');
    }, /Failed to execute 'add' on 'DataTransferItemList'/);

    var newItem = dataTransfer.items.add('custom', 'text/custom');

    equal(newItem.type, 'text/custom');

    equal(dataTransfer.items.length, 3);
    equal(dataTransfer.items[2].type, 'text/custom');

    throws(function () {
        dataTransfer.items.add('new data', 'text/plain');
    }, /Failed to execute 'add' on 'DataTransferItemList': An item already exists for type 'text\/plain'./);

    // Replace item
    dataTransfer.setData('text/plain', 'new data');

    types = dataTransfer.types;

    equal(types.length, 3);
    equal(types[0], 'text/uri-list');
    equal(types[1], 'text/custom');
    equal(types[2], 'text/plain');

    equal(dataTransfer.items[0].type, 'text/uri-list');
    equal(dataTransfer.items[1].type, 'text/custom');
    equal(dataTransfer.items[2].type, 'text/plain');

    // Remove items
    dataTransfer.clearData('text/uri-list');

    equal(dataTransfer.items.length, 2);
    equal(dataTransfer.getData('text/uri-list'), '');
    equal(dataTransfer.items[1].type, 'text/plain');
    equal(dataTransfer.items[2], void 0);

    dataTransfer.items.remove(0);
    equal(dataTransfer.items.length, 1);
    equal(dataTransfer.getData('text/custom'), '');
    equal(dataTransfer.items[0].type, 'text/plain');
    equal(dataTransfer.items[1], void 0);

    dataTransfer.clearData();
    equal(dataTransfer.items.length, 0);
    equal(dataTransfer.getData('text/plain'), '');
    equal(dataTransfer.items[0], void 0);
});

asyncTest('DataTransferItem', function () {
    var dataTransfer = new DataTransfer();

    dataTransfer.setData('text/plain', 'data');

    var item = dataTransfer.items[0];

    equal(item.getAsFile(), null);

    throws(function () {
        item.getAsString();
    }, /Failed to execute 'getAsString' on 'DataTransferItem'/);

    item.getAsString(function (res) {
        equal(res, 'data');
        start();
    });
});

test('DataStore mode', function () {
    var dataTransfer = new DataTransfer();

    dataTransfer.setData('text/plain', 'data');
    equal(dataTransfer.items.length, 1);

    dataTransfer._setReadOnlyMode();
    dataTransfer.setData('text/custom', 'custom');
    dataTransfer.items.add('custom', 'text/custom');
    equal(dataTransfer.items.length, 1);

    dataTransfer.clearData();
    dataTransfer.items.remove(0);
    dataTransfer.items.clear();
    equal(dataTransfer.items.length, 1);

    dataTransfer.dropEffect = 'copy';
    equal(dataTransfer.dropEffect, 'copy');

    dataTransfer._setProtectedMode();
    equal(dataTransfer.getData('text/custom'), '');
    equal(dataTransfer.items.length, 0);
    equal(dataTransfer.items[0], void 0);
    equal(dataTransfer.types.length, 0);

    dataTransfer.setData('text/custom', 'custom');
    dataTransfer.items.add('custom', 'text/custom');
    equal(dataTransfer.items.length, 0);
});
