# 双人小屋 Android

Android Studio 打开本目录；使用 JDK 21、Android SDK Platform 36，最低 Android 8.0。纯 Java WebView 壳，网页和字体随 APK 内置，不从外部 CDN 加载。

## 构建

macOS：`./scripts/build.sh`；其他系统设置 `JAVA_HOME` / Android SDK 后执行 `gradlew assembleRelease`（Windows 为 `gradlew.bat assembleRelease`）。构建会自动将相邻 `../web/` 同步到 APK assets。APK 输出：`app/build/outputs/apk/release/`。

版本 1.1.2（versionCode 5）沿用原包名和签名，可覆盖安装旧包并保留登录。构建同步明确排除 `characters-preview.html` 和 `fp-ui-preview.html`；这两个预览页只保留在网页源码目录中。

在工程根目录执行 `python3 tests/verify-apk.py android/app/build/outputs/apk/release/app-release.apk`，检查 APK 版本、签名、网页资源一致性及预览页排除。

### 隔离验收包

给构建增加 `-ProomTestServer=https://your-test-host/path`，会生成独立包名 `cn.coupleroom.app.preview`、名称“双人小屋验收版”的 APK。只有该包生成的 assets 中服务器地址会被替换，`web/config.js` 源文件不变。参数只接受不含账号、查询或片段的 HTTPS 地址。

```sh
./scripts/build.sh -ProomTestServer=https://your-test-host/path
```

验收包使用独立的登录与存储，不会继承正式包的生产账号。校验时为脚本加 `--test-server https://your-test-host/path`。构建参数作为资源同步任务的输入记录；之后不带参数重新构建，会恢复生产包名与源文件的服务器配置。

服务默认地址取 `../web/config.js`，当前为 `https://api.xn--zbs33ddmy9oeqa.club/couple-room`。本壳仅允许 HTTPS API，服务器输入框应填写 HTTPS 地址。

## 签名

专用私钥保存在构建机受保护目录，不随源码交付。要生成相同签名的更新包，应继续使用原密钥。通过环境变量 `COUPLE_ROOM_SIGNING_PROPERTIES` 指定本机配置文件，字段如下：

```properties
storeFile=/absolute/path/to/release.jks
storePassword=your-store-password
keyAlias=couple-room
keyPassword=your-key-password
```

本机默认配置引用：`~/.local/share/couple-room/android-signing/release.properties`。缺少签名配置时 Gradle 生成 unsigned release，安装前需自行签名。

## 壳行为

- 使用 `WebViewAssetLoader` 的 HTTPS 本地资源域，启用 JavaScript、DOM storage 和硬件加速。
- 系统文件选择器处理图片上传与取消，无需相册广泛访问权限。
- 页面外链交给系统浏览器；返回键先调用网页 `window.__back()` 关闭面板。
- HTTPS 证书由系统验证；无明文网络、无跨域 JavaScript 原生桥、无 WebView 远程调试。
- 独立包名 `cn.coupleroom.app`，关闭系统备份，不修改设备键盘或输入法。
- 横竖屏均让房间画面延伸到屏幕边缘；从边缘滑动可临时显示系统栏。原生只为键盘缩小 WebView，刘海/系统手势区域交给网页控件的安全区留距，不为整个画面留背景带。
- WebView 133 等旧版本通过原生传入的 `--android-safe-*` CSS 数值获取安全区，较新 WebView 的 `env(safe-area-inset-*)` 与其取最大值，不重复累加；键盘收起与旋转会刷新四边数值。无 JavaScript 原生对象桥。
