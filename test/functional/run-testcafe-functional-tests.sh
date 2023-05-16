#!/usr/bin/env bash

mkdir ../testcafe
cd ../testcafe
git clone https://github.com/DevExpress/testcafe .

npm install testcafe-hammerhead ../testcafe-hammerhead --save
npm i --loglevel error

npm test
