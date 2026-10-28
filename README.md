# WanderXuan · 双人小屋

给两个人使用的 3D 共享小屋：在 Android 手机上分别登录，照片墙、便利贴、信件、书架和打卡等内容通过 PocketBase 实时同步。

本仓库保存已交付的 **1.0.0** 项目，包含 Android Studio 工程、完整网页资源及后端部署文件。

## 安装 Android App

[下载已签名的双人小屋 1.0.0 APK](https://api.xn--zbs33ddmy9oeqa.club/couple-room/downloads/CoupleRoom-1.0.0.apk)

支持 Android 8.0 及以上。服务器地址已内置；两个使用者分别选择自己的名字登录。实际账号密码单独交付，不存放在仓库中。

## 项目结构

```text
android/       Android Studio 工程、WebView 壳和 Gradle 构建入口
web/           网页入口、Three.js 场景、交互及 PocketBase 同步层
server/        PocketBase 数据迁移、Linux 二进制包及 SHA256 清单
deployment/    部署脚本、后端验证脚本、部署说明和版本记录
icons/         应用图标
```

网页脚本、字体和图标均随 APK 打包，不依赖外部 CDN。

## 构建 APK

Android Studio 打开 `android/`，使用 JDK 21、Android SDK Platform 36、Gradle 8.13 和 Android Gradle Plugin 8.11.1。

macOS：

```sh
cd android
./scripts/build.sh
```

Windows 配置 JDK 与 Android SDK 后，在 `android/` 运行：

```bat
gradlew.bat assembleRelease
```

构建会将 `web/` 同步到 Android assets。输出目录为 `android/app/build/outputs/apk/release/`。

签名配置和私钥独立保存在构建机，未上传；缺少签名配置时生成未签名 release 包。签名配置方式及 WebView 行为见 [Android 说明](android/README.md)。

## 后端

- PocketBase：0.40.5，独立 systemd 服务及持久化数据目录。
- API：`https://api.xn--zbs33ddmy9oeqa.club/couple-room`。
- [健康检查](https://api.xn--zbs33ddmy9oeqa.club/couple-room/api/health)。
- Nginx 提供 HTTPS 和实时订阅代理，PocketBase 监听服务器本机地址。

部署脚本对应当前交付环境。文件位置、服务维护、备份及构建工具链见 [部署与构建说明](deployment/部署与构建说明.txt)。后端验证脚本从外部凭据文件读取密码，调用方式见 [verify_backend.py](deployment/verify_backend.py)。

原始压缩包的交接资料保留在 [原始交接说明](deployment/原始交接说明.md)。其中提到的默认密码已在云端替换。

## 版本核验

1.0.0 已完成签名 APK 构建、Android 模拟器检查和 11 项后端检查。后端结果见 [backend-verification.json](deployment/backend-verification.json)，源码及 APK 哈希见 [release-manifest.json](deployment/release-manifest.json)。

字体和 Three.js 的许可文件随对应资源保留。服务器业务数据、数据库、账号凭据和签名私钥均不包含在仓库中。
