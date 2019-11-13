#!/usr/bin/env bash

mkdir ../testcafe
cd ../testcafe
git clone https://github.com/DevExpress/testcafe .

npm install testcafe-hammerhead ../testcafe-hammerhead --save
npm i
npm run prepare
npm i --loglevel error

export GULP_TASK="test-functional-local-headless-chrome"
npm test
