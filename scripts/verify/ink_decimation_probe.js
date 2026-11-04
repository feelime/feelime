/* JVM 跨语言回归入口：运行真实键盘抽稀，stdout 只返回桥 payload。 */
'use strict';
const fs = require('fs');
const { KeyboardWorld } = require('./mock_bridge_harness');
const world = new KeyboardWorld().build();
const cases = JSON.parse(fs.readFileSync(0, 'utf8'));
process.stdout.write(JSON.stringify(cases.map(strokes => ({
    w: 320, h: 132,
    strokes: world.context.Feelime.inkDecimate(strokes),
    originalStrokeSizes: strokes.map(stroke => stroke.length),
}))));
