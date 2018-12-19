const globby     = require('globby');
const path       = require('path');
const replaceExt = require('replace-ext');
const fs         = require('fs');

(async () => {
    let paths = await globby(['./src/**/*.js', '!./src/client/**/*.js']);

    paths = paths.map(item => path.resolve(item));

    paths.forEach(item => {
        const newPath = replaceExt(item, '.ts');

        fs.renameSync(item, newPath);
    });
})();
