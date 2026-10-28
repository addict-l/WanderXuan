# 双人小屋 Android

Android Studio 打开本目录；使用 JDK 21、Android SDK Platform 36，最低 Android 8.0。纯 Java WebView 壳，网页和字体随 APK 内置，不从外部 CDN 加载。

## 构建

macOS：`./scripts/build.sh`；其他系统设置 `JAVA_HOME` / Android SDK 后执行 `gradlew assembleRelease`（Windows 为 `gradlew.bat assembleRelease`）。构建会自动将相邻 `../web/` 同步到 APK assets。APK 输出：`app/build/outputs/apk/release/`。

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
