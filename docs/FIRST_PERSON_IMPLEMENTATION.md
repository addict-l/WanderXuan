# 小人视角实现与验收

实现分支：`feat/first-person-interactions`，基于 `ui/characters` 的 `9f25c05`。验收依据依次为 `FIRST_PERSON.md`、`FP_UI.md` 和 `CHARACTERS.md`。按用户后续指示，本轮先使用模拟器验证；两台实体手机的联调和中低端机性能仍需复核。

## 模块分工

```text
FPUI（原有界面与事件）
  └─ fp-controller.js：相机、输入接线、目标、角色与动作
       ├─ fp-world.js：移动、家具碰撞、位置修复、角度与插值
       ├─ CoupleChars（原有造型与动作）
       └─ App / Sync：本人 person 行、资料补丁、位置与事件
```

`characters.js`、`fp-ui.js`、`fp-ui.css` 保持原样，没有另画按钮。`scene.js` 保留房间、灯光、原面板和俯瞰操作；沙发上的原小熊、小兔与可走动的小人同时保留，各自可以点击。

## 相机、移动与交互

- 默认从俯瞰开始，约 1 秒后用 1.2 秒飞入自己的眼睛；减少动态效果时直接进入，关闭相机的走路晃动。
- 第一人称竖屏 FOV 70°、横屏 55°、近裁剪面 0.05。自己的角色隐藏，对方角色可见。进入俯瞰恢复原相机与 OrbitControls。
- 左摇杆/WASD 按朝向移动，默认速度 1.6 单位/秒。拖看俯仰限制为 ±60°。人物半径取 `CoupleChars.info.radius`。
- 碰撞使用文档中的矩形、圆和房间边界，分小步移动并沿边滑动。陈旧或非法远端位置先修复到合法位置。
- 准星与直接点击都重新执行 2.5 单位射线检查；只命中可见角色/物件。目标变化时才更新 FPUI 目标名及材质微光，面板继续走原来的 `App.act()`。
- 面板、菜单、教程、进门遮罩、失焦和后台均停止走路。通过既有 `pointercancel` / `blur` 输入路径清理摇杆与 WASD，没有修改键盘或输入法设置。多指拖看整组结束前不会被当成轻点。
- 对方位置在 0.4 秒内插值；角度沿最短弧旋转。离线或没有位置数据时坐在沙发中间偏前的位置，避开原来的两只玩偶；双方距离小于 1.2 时转头看向彼此。
- 低配置触屏设备使用小人模块现有的 `outline: false` 选项，造型源文件未改。

## 状态和同步字段

不新增 PocketBase collection，不执行数据库迁移。原有 `items(kind, ref, data)` 中的 `person/0`、`person/1` 继续使用。

| 新状态 | person 行 `data` 字段 | 含义 |
|---|---|---|
| `state.positions[2]` | `pos: {x,z,ry,motion,at}` | 地面位置、朝向、持续动作及位置时间戳；缺省 `null` |
| `state.presence[2]` | `presence: {active,at}` | 显式活跃状态；缺省 `null`，旧行可继续用 `lastSeen` |
| `state.gestures[2]` | `events[]` | 本人发出的动作/戳一戳事件，最多 32 条，发布时清理过期记录 |
| `state.profileEdits[2]` | `profileEdits` | 按 `目标who:字段` 保存资料补丁，最多 6 个键 |
| 无独立业务状态 | `revision` | 单调版本戳，丢弃乱序的旧 person 快照 |

`events` 的共同字段是 `{id,from,type,at}`；表情动作另有 `name: wave|jump|nod`；戳一戳另有 `to`、`line`。两端显示同一句已发送的戳一戳话语。事件通过 ID 去重，首次加载和重连刷新只建立历史基线，不重新播放旧动作。

`profileEdits` 示例：

```json
{
  "1:name": { "value": "对方的名字", "at": 1793200000000, "id": "session:counter" }
}
```

可编辑字段为 `name`、`city`、`mood`。新客户端只写自己的 person 行；旧面板编辑双方姓名/城市时，补丁也写在本人行中，按 `at` 和稳定 `id` 合并，避免覆盖对方的位置与动作。已有的 `name`、`city`、`mood`、`lastSeen` 顶层字段继续保留。

移动最多每秒发布一次改变的位置，停止额外立即发布最终位置。发送节流使用本机单调时间；新协议位置按行 `revision` 接收，不用手机的 `pos.at` 判定先后，手机校时不会冻结移动。心情、动作和普通业务保存不会绕过位置限频；尚未发出的本机移动与业务修改也不会被收到的 SSE 快照覆盖。未知物件种类不会被当作需要删除的数据。

活跃心跳每 15 秒一次，租约为 30 秒；后台/退出显式离线。远端租约使用接收端的单调时间；首次快照结合 PocketBase 已有的 `updated` 服务端时间判定，避免两台手机时钟不同步造成错误在线状态。`updated` 仅在同步层内部使用，不新增 `data` 字段。

场景接线 API：

```js
App.setPosition({ x, z, ry, motion }, { stopped: true });
App.sendEmote('wave');
App.sendPoke(1 - App.state.me);
Sync.setPresence(!document.hidden);
```

App 事件：本地 `emote` / `poke`，远端 `remote-emote` / `remote-poke`。person 动态更新只发位置、在线状态或实际变化的资料事件，不为每秒位置更新重建整个房间。

视角偏好保存在本机 `localStorage['couple-room-view']`；现成 UI 使用自己的 `fpui-tutorial-done`。它们不写入共享房间状态。

## 兼容与打包

- 旧行缺少新字段时安全默认，旧面板、照片文件令牌及业务集合不变。
- 完整位置与动作同步需要两端都更新。旧 1.0.0 客户端会整行覆盖 person JSON，无法替旧客户端补上本人行所有权协议。
- 正式 APK 为 `cn.coupleroom.app`，1.1.2/code 5，沿用原签名。
- `-ProomTestServer=<httpsURL>` 生成独立 `cn.coupleroom.app.preview`，只改构建生成的配置，不改 `web/config.js`；验收不使用生产房间。
- `characters-preview.html`、`fp-ui-preview.html` 保留在网页源码，两个 APK 均排除这两页。提交前恢复生产 assets。
- 增加普通 `VIBRATE` 权限供现成通知调用使用；物理触感仍需真机确认。
- 1.1.1 横竖屏采用沉浸窗口和 cutout 绘制，画面与准星覆盖完整 WebView；`viewport.css` 只为现有控件/面板留安全区。旧 WebView 使用原生传入的 `--android-safe-top/right/bottom/left`（CSS px），与 `env()` 取最大值。键盘仅在原生缩小一次；旋转用实际 stage 的 ResizeObserver 更新画布和相机，不重置小人位置。

## 可复核的检查

```sh
npm ci
npm test
# 需要 Chrome，或先 npx playwright install chromium
FP_TEST_CREDENTIALS=/private/path/test-credentials.json npm run test:browser

cd android
./scripts/build.sh :app:lintRelease
./scripts/build.sh -ProomTestServer=https://your-test-host/validation/first-person
```

浏览器脚本要求使用 `/validation/` 下的隔离后端。凭据 JSON 结构为 `server` 与 `accounts`，每个账号含 `name`、`email`、`who`、`password`；凭据不提交、不写入 APK 或报告。

测试结果、截图和按需求逐项的验收记录见 [validation/first-person/README.md](validation/first-person/README.md)。桌面 Chrome 的帧率记录不代表中低端 Android 真机达到 30 FPS。

1.1.1 的横屏边缘修复与键盘/安全区复核见 [validation/landscape/README.md](validation/landscape/README.md)，专项脚本为 `npm run test:viewport`。

1.1.2 恢复原沙发玩偶，与新小人共存；离线小人展示座位位于沙发前缘中间。点击来源经 controller 的 `activate(owner)` 同步传递给本地 `onPoke`，确保玩偶气泡锚定原玩偶，远端仍使用原事件协议。结果见 [validation/mascot-restore/README.md](validation/mascot-restore/README.md)。

## 交给 Claude 的 UI 问题

模拟器发现现有新手引导的“走路”和“互动”说明重叠到左上角。原因是 `fp-ui.css:3` 的 `--gap`、`--gapr`、`--bot` 只定义在 `.fp`，而 `fp-ui.js` 把 `.fp-tut` 添加为 `body` 下的同级节点；`fp-ui.css:98–103` 使用这些变量时没有继承值。

请由 Claude 为教程节点提供相同的变量作用域或回退值。本 PR 保留三个受保护文件原样，不在其他文件绕过修改外观；“知道了”仍可用，核心操作可继续验收。无需新增按钮或 FPUI 事件。
