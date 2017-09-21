"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
require('dotenv').config();
const assert = require('assert');
const tape = require('tape');
const Qonvoy = require("./qonvoy");
Qonvoy.init({
    redisConnectionString: process.env.REDIS_URL
});
function runTests() {
    return __awaiter(this, void 0, void 0, function* () {
        let id = null;
        yield tape.test('add', (t) => __awaiter(this, void 0, void 0, function* () {
            t.plan(1);
            id = yield Qonvoy.add('test', {
                testing: true
            });
            t.equal(typeof id, 'string');
        }));
        yield tape.test('status', (t) => __awaiter(this, void 0, void 0, function* () {
            t.plan(1);
            let result = yield Qonvoy.status('test', id);
            t.equal(id, result.id);
        }));
        yield tape.test('process next', (t) => __awaiter(this, void 0, void 0, function* () {
            t.plan(1);
            let result = yield Qonvoy.processOne('test', id, (item) => __awaiter(this, void 0, void 0, function* () {
                t.equal(id, item.id);
                return true;
            }));
        }));
    });
}
runTests();
