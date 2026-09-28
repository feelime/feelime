# 构建（新机器 / 换环境）

从一台裸机器到出第一个 APK 的完整步骤。所有路径/代理都是机器级配置，
不入仓库；本页命令可在任何新 clone 上照抄（占位符按本机替换）。

日常速记（已配好的机器）：

```bash
./scripts/setup-assets.sh          # 仅首次或资产更新
ANDROID_HOME=… JAVA_HOME=… ./gradlew :app:assembleDirectDebug
```

## 0. 四个最容易踩的坑

1. **Java 版本**：Gradle 8.12 最高支持 JDK 23，AGP 8.10 最低要 JDK 17。
   新发行版的默认 java（如 25）会让 gradle 起不来（class file 版本不认）。
   用 JDK 21 最稳，构建时显式 `JAVA_HOME=` 指到它。
2. **gradle 代理**：gradle（wrapper 下载、依赖解析）**不读 `http_proxy`
   环境变量**，只认 JVM 系统属性（§2.2）。curl 恰好相反（认环境变量），
   所以 setup-assets.sh 不用额外配代理。
3. **SDK 定位**：AGP 只认 `ANDROID_HOME` 环境变量或 `local.properties` 的
   `sdk.dir`；`~/.config/feelime/env.sh` 里的 `FEELIME_ANDROID_HOME` 只是
   本机记录，gradle 不消费。
4. **先跑 setup-assets.sh**：否则 gradle configure 阶段直接报 sherpa AAR
   缺失（fail-fast，报错会指向该脚本）。

## 1. 前置组件

| 组件 | 版本要求 | 说明 |
| --- | --- | --- |
| JDK | 17–23，推荐 21 | 见 §0.1；`java -version` 确认实际跑的是哪个 |
| Android SDK | platforms;android-36、build-tools;36.1.0 | cmdline-tools 可用 sdkmanager 补装 |
| NDK | 28.x | 仅 pinned native 管线（引擎数据再生成）用，日常 APK 构建不编译 native |
| curl / python3 / node | 系统包管理器 | 资产下载 / 验证套件 |

## 2. 一次性配置

### 2.1 机器配置目录 ~/.config/feelime/

键位表见 [AGENTS.md](../../AGENTS.md)「本机构建环境」。换机器必须带上的：

- `env.sh`：SDK/NDK 路径、`FEELIME_ADB_SERIAL` 等机器级键值；命令行要用
  里面的键时先加载：`. scripts/feelime-env.sh`（只填未设置的 `FEELIME_*`
  变量，显式环境变量优先）；
- **共享 `debug.keystore`**（并配 `FEELIME_DEBUG_KEYSTORE*` 四个键）：
  每台机器默认 debug.keystore 不同，签名不一致的包互相「升级」会被系统
  判为不同应用、强制卸载重装——用户设置与词库全丢；
- `models/`、`android/`：下一步的 setup-assets.sh 生成。

### 2.2 gradle 代理（网络环境需要时）

写进 `~/.gradle/gradle.properties`（机器级，勿提交）：

```properties
systemProp.http.proxyHost=<proxy-host>
systemProp.http.proxyPort=<proxy-port>
systemProp.https.proxyHost=<proxy-host>
systemProp.https.proxyPort=<proxy-port>
systemProp.http.nonProxyHosts=localhost|127.0.0.1
```

### 2.3 ANDROID_HOME

```bash
export ANDROID_HOME=/opt/android-sdk   # 换成 SDK 实际位置，写进 ~/.bashrc
```

或写 `local.properties`（同样不入仓库）：
`echo "sdk.dir=$ANDROID_HOME" > local.properties`。

## 3. 构建资产

```bash
./scripts/setup-assets.sh
```

- 内容：sherpa-onnx AAR + 流式/整句 ASR、标点、手写模型，全部 SHA-256
  校验（模型清单哈希与 `models/manifest.json` 同源）；
- 位置：`~/.config/feelime/{android,models}`，所有 worktree/clone 共享，
  重复跑已校验的文件零流量；
- 完成标志：打印 AAR 与 models 路径，且仓库内
  `app/src/modelAssets/full` 符号链接指向模型树（脚本自动创建）。

## 4. 构建

full 模型包是默认值（thin 才需要 `-PfeelimeModels=thin`）。

```bash
# 直接调 gradle（JAVA_HOME 按 §1 换成本机 JDK 21 路径）
ANDROID_HOME=$ANDROID_HOME JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 \
  ./gradlew :app:assembleDirectDebug

# 或脚本：x86_64 直接透传；arm64 主机要求 FEELIME_AAPT2 指向 x86_64 aapt2
./scripts/build-debug.sh    # assembleDebug = direct+play 两渠道都出
```

产物：`app/build/outputs/apk/direct/debug/app-direct-debug.apk`
（full 约 340MB）。日常装机走 `./scripts/install-debug-apk.sh <serial>`。

## 5. 换环境首包核验

```bash
APK=app/build/outputs/apk/direct/debug/app-direct-debug.apk
BT=$ANDROID_HOME/build-tools/36.1.0
$BT/aapt2 dump badging $APK | head -1          # 包名/版本对
unzip -l $APK | grep -cE 'asr-model|final-model|punctuation|handwriting'
$BT/apksigner verify --print-certs $APK        # 证书 SHA-256
keytool -list -v -keystore ~/.config/feelime/debug.keystore \
  -storepass "$FEELIME_DEBUG_STORE_PASSWORD" -alias androiddebugkey | grep SHA256
```

- `unzip` 计数 full 包应 ≥4（流式 ASR / 整句 / 标点 / 手写模型各在位）；
- **两个 SHA-256 必须一致**：不一致说明没走共享 debug.keystore，装机即
  §2.1 说的卸载重装事故。

然后按 [testing/verification.md](../testing/verification.md) 跑本地三层
（css lint / mock 桥 / JVM 单测）确认新环境完整可用。
