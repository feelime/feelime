# R8（minifyEnabled true，Play App optimization 要求）。规则按「谁按名字
# 找代码」来保：JNI 按符号名绑定、WebView 按注解反射取方法。

# JNI 名称绑定：native 方法经 Java_pkg_Class_method 符号名绑定
# （librime/smoke 引擎、sherpa-onnx）。类名或方法名被混淆即
# UnsatisfiedLinkError。
-keepclasseswithmembernames class * {
    native <methods>;
}

# WebView JS bridge：keyboard.js / 设置页经 addJavascriptInterface 调
# FeelimeNative / SettingsBridge，注解反射查找成员。
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# sherpa-onnx AAR：JNI 直呼其数据类（SupplementalContext 之类按字段名
# 取值），保守全保。
-keep class com.k2fsa.sherpa.onnx.** { *; }

# onnxruntime4j（onnxruntime-android AAR）：native 返回路径按名字反射
# 构造数据类——getInputInfo 在 C++ 侧 GetMethodID(NodeInfo.<init>) 后
# NewObject，Java 侧零调用点，R8 会把只被 native 反射用的构造器删掉，
# 类 shrink 成空壳 → release 手写初始化必崩 NoSuchMethodError（1.3.9~
# 1.3.11 release 用户，PJC110 三连 tombstone 定罪；debug 无 R8 故
# ace/AVD 验证不暴露）。保守全保。
-keep class ai.onnxruntime.** { *; }

# commons-compress 的 zstd 分支是可选依赖（R8 生成的 missing_rules），
# 模型 zip 走 deflate，不用 zstd。
-dontwarn com.github.luben.zstd.ZstdInputStream
