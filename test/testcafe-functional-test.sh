#!/bin/bash

node node_modules/gulp/bin/gulp build
mkdir ../testcafe
cd ../testcafe
git clone https://github.com/DevExpress/testcafe .
npm install testcafe-hammerhead ../testcafe-hammerhead --save
npm i --loglevel error
GULP_TASK="test-functional-local-headless"
npm test
