plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.feelime.ime.spike"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.feelime.ime.asrbaseline"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
        ndk { abiFilters += "arm64-v8a" }
    }

    // The ASR models live outside app assets, in
    // src/modelAssets/full (thin-build prep) - the spike shares BOTH.
    sourceSets.getByName("main").assets.srcDirs(
        "../../../app/src/main/assets",
        "../../../app/src/modelAssets/full",
    )

    buildTypes {
        debug {
            signingConfig = signingConfigs.getByName("debug").apply {
                enableV1Signing = true
                enableV2Signing = true
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    androidResources { noCompress += listOf("onnx", "txt", "vocab") }
    packaging { jniLibs { useLegacyPackaging = true } }
}

dependencies {
    // 与主项目 app/build.gradle.kts 同源同变体：sherpa 走共享目录
    // （~/.config/feelime/android）的 static-link-onnxruntime 变体，app/libs
    // 仅兜底。旧写法硬编码 app/libs/sherpa-onnx-1.13.6.aar，9-21 主项目
    // 换变体清掉 libs 后 spike 构建即断（2026-09-24 门 11 段实录）。
    val aarName = "sherpa-onnx-static-link-onnxruntime-1.13.6.aar"
    val sharedAarDir = File(
        System.getProperty("user.home") + "/.config/feelime/android")
    val sherpaAar = sequenceOf(File(sharedAarDir, aarName), File(projectDir, "../../../app/libs/$aarName"))
        .firstOrNull { it.isFile }
        ?: throw GradleException("$aarName not found in shared dir or app/libs")
    implementation(files(sherpaAar))
}
