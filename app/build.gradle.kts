import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest

// Machine-local build environment: ~/.config/feelime/env.sh (see AGENTS.md,
// "Machine-local build environment"). The open-source repo never stores SDK
// paths, hostnames or signing secrets; this per-machine file is shared by
// every worktree. It is parsed as KEY=VALUE lines - never executed - and an
// explicit environment variable always wins over a file entry.
val feelimeEnvValues: Map<String, String> by lazy {
    val values = mutableMapOf<String, String>()
    val dir = System.getenv("FEELIME_CONFIG_DIR")
        ?: (System.getProperty("user.home") + "/.config/feelime")
    val file = File(dir, "env.sh")
    if (file.isFile) {
        for (raw in file.readLines()) {
            val line = raw.substringBefore("#").trim()
            val eq = line.indexOf('=')
            if (eq <= 0) continue
            val key = line.substring(0, eq).trim()
            val value = line.substring(eq + 1).trim().trim('"', '\'')
            if (key.matches(Regex("FEELIME_[A-Z0-9_]+")) && value.isNotEmpty()) {
                values.putIfAbsent(key, value)
            }
        }
    }
    values
}

fun feelimeEnv(name: String): String? =
    System.getenv(name)?.takeIf { it.isNotEmpty() } ?: feelimeEnvValues[name]

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// fail-fast audit binding the production engine artifacts in this
// tree to the audited third_party/manifest.json outputs, and the runtime
// engine-data/MANIFEST.json entries, before anything is packaged.
val checkEngineArtifacts = tasks.register("checkEngineArtifacts") {
    doLast {
        fun sha256(file: File): String {
            val digest = MessageDigest.getInstance("SHA-256")
            FileInputStream(file).use { input ->
                val buffer = ByteArray(1 shl 16)
                while (true) {
                    val read = input.read(buffer)
                    if (read < 0) break
                    digest.update(buffer, 0, read)
                }
            }
            return digest.digest().joinToString("") { "%02x".format(it) }
        }

        val failures = mutableListOf<String>()
        val thirdParty = rootProject.file("third_party/manifest.json")
        if (!thirdParty.isFile) {
            throw GradleException("missing third_party/manifest.json")
        }
        val outputs = (groovy.json.JsonSlurper().parse(thirdParty) as Map<*, *>)["outputs"] as List<Map<*, *>>
        var bound = 0
        for (entry in outputs) {
            val rel = entry["path"] as String
            val production = when {
                // Production copies: the app ships these bytes (the spike APK
                // reuses the same files via its sourceSets).
                rel.startsWith("app/src/main/assets/engine-data/") && !rel.endsWith("MANIFEST.json") ->
                    rootProject.file(rel)
                rel.startsWith("app/src/main/jniLibs/arm64-v8a/") ->
                    rootProject.file(rel)
                // x86_64 engine libraries are spike-only.
                rel.startsWith("spikes/native-engine-smoke/app/src/main/jniLibs/x86_64/") ->
                    rootProject.file(rel)
                else -> null
            } ?: continue
            bound += 1
            if (!production.isFile) {
                failures += "missing ${production.relativeTo(projectDir)}"
                continue
            }
            if (production.length() != (entry["bytes"] as Number).toLong() ||
                sha256(production) != entry["sha256"]
            ) {
                failures += "hash/size mismatch for ${production.relativeTo(projectDir)}"
            }
        }

        val runtimeManifest = File(projectDir, "src/main/assets/engine-data/MANIFEST.json")
        val runtimeFiles =
            (groovy.json.JsonSlurper().parse(runtimeManifest) as Map<*, *>)["files"] as Map<*, *>
        for ((rel, meta) in runtimeFiles) {
            val f = File(projectDir, "src/main/assets/engine-data/$rel")
            val m = meta as Map<*, *>
            if (!f.isFile) {
                failures += "missing engine-data/$rel (runtime manifest)"
                continue
            }
            if (f.length() != (m["bytes"] as Number).toLong() || sha256(f) != m["sha256"]) {
                failures += "hash/size mismatch for engine-data/$rel (runtime manifest)"
            }
        }

        if (failures.isNotEmpty()) {
            throw GradleException("engine artifact audit failed:\n  " + failures.joinToString("\n  "))
        }
        logger.lifecycle("engine artifact audit passed ($bound outputs bound, ${runtimeFiles.size} runtime files verified)")
    }
}

tasks.named("preBuild") { dependsOn(checkEngineArtifacts) }

// Embed a VERIFIED model manifest (real sha256/bytes
// computed from the local full model copies - the shared
// ~/.config/feelime/models tree or the legacy in-tree fallback, installed by
// scripts/setup-assets.sh) into assets for BOTH full and thin builds - the
// ModelStore downloader checks every byte it writes against these digests.
// The repo copy (models/manifest.json) carries mirror URL prefixes but
// placeholder digests; when no local model copies exist the repo copy is
// embedded as-is and downloads refuse to start (verified=false) instead of
// installing unverifiable bytes.
val modelManifestOut = layout.buildDirectory.dir("generated/modelManifest")
val devUrlsFile = rootProject.file("models/dev-urls.json")
val devModelUrlsOptIn =
    (properties["feelimeDevModels"] as? String).equals("true", ignoreCase = true)
val requestedTasks = gradle.startParameter.taskNames.map { it.substringAfterLast(':') }
val hasDirectDebugTask = requestedTasks.any { it.contains("DirectDebug", ignoreCase = true) }
val hasPlayOrReleaseTask = requestedTasks.any {
    it.contains("Play", ignoreCase = true) || it.contains("Release", ignoreCase = true)
}
if (devModelUrlsOptIn) {
    // startParameter.taskNames can contain a wrapper alias and therefore
    // cannot prove which variants the graph will execute. Inspect the real
    // graph before execution so an alias or a mixed invocation cannot route
    // this private LAN source into a Play/release manifest.
    gradle.taskGraph.whenReady {
        val forbidden = allTasks.filter { task ->
            task.project.path == ":app" && (
                task.name.contains("Play", ignoreCase = true) ||
                    task.name.contains("Release", ignoreCase = true)
                )
        }
        if (forbidden.isNotEmpty()) {
            throw GradleException(
                "feelimeDevModels=true is limited to directDebug tasks; " +
                "refusing a Play/release task so private model URLs cannot enter its manifest",
            )
        }
    }
}
val devModelUrlsRequested = devModelUrlsOptIn && hasDirectDebugTask && !hasPlayOrReleaseTask
val modelPack = (properties["feelimeModels"] as? String) ?: "full"

// ASR model bytes live OUTSIDE the repo (never committed): the shared
// per-machine tree (~/.config/feelime/models, installed by
// scripts/setup-assets.sh) wins; the legacy in-tree copy stays a fallback
// so an existing checkout keeps building unchanged.
val repoModelsDir = File(projectDir, "src/modelAssets/full")
fun sharedModelsDir(): File =
    File(
        feelimeEnv("FEELIME_MODELS_DIR")
            ?: (System.getProperty("user.home") + "/.config/feelime/models"),
    )
val modelsDir = when {
    sharedModelsDir().isDirectory -> sharedModelsDir()
    repoModelsDir.isDirectory -> repoModelsDir
    else -> null
}
val releaseKeystorePath = feelimeEnv("FEELIME_RELEASE_KEYSTORE").orEmpty()
val releaseStorePassword = feelimeEnv("FEELIME_RELEASE_STORE_PASSWORD")
val releaseKeyAlias = feelimeEnv("FEELIME_RELEASE_KEY_ALIAS").orEmpty()
val releaseKeyPassword = feelimeEnv("FEELIME_RELEASE_KEY_PASSWORD")
val releaseSigningConfigured =
    releaseKeystorePath.isNotEmpty() &&
        releaseStorePassword != null &&
        releaseKeyAlias.isNotEmpty() &&
        releaseKeyPassword != null &&
        File(releaseKeystorePath).isFile
val generateModelManifest = tasks.register("generateModelManifest") {
    outputs.dir(modelManifestOut)
    // Without declared inputs the task goes UP-TO-DATE
    // across manifest/dev-urls/model-file edits and ships a stale digest
    // table (silent device-side sha mismatches). The models dir is declared
    // as an input ONLY (not an input dir of the asset merge), so a model
    // byte change reruns digesting without repackaging anything else.
    inputs.file(rootProject.file("models/manifest.json"))
    // LAN mirrors are an explicit directDebug-only opt-in. Including this
    // file merely because it exists would leak a private hostname into a
    // release/Play manifest and could make a production build prefer it.
    inputs.property("devModelUrlsRequested", devModelUrlsRequested)
    inputs.property("devModelUrlsPresent", devUrlsFile.isFile)
    if (devModelUrlsRequested && devUrlsFile.isFile) inputs.file(devUrlsFile)
    inputs.dir(modelsDir ?: repoModelsDir).skipWhenEmpty()
    doLast {
        val outDir = modelManifestOut.get().asFile.resolve("models")
        outDir.mkdirs()
        val manifest = groovy.json.JsonSlurper().parse(rootProject.file("models/manifest.json")) as Map<*, *>
        // When explicitly enabled, prepend LAN mirror prefixes so device
        // tests download from the local nginx instead of the HF mirrors.
        val devUrls = if (devModelUrlsRequested && devUrlsFile.isFile) {
            groovy.json.JsonSlurper().parse(devUrlsFile) as List<*>
        } else {
            null
        }
        fun sha256(file: File): String {
            val digest = MessageDigest.getInstance("SHA-256")
            FileInputStream(file).use { input ->
                val buffer = ByteArray(1 shl 16)
                while (true) {
                    val read = input.read(buffer)
                    if (read < 0) break
                    digest.update(buffer, 0, read)
                }
            }
            return digest.digest().joinToString("") { "%02x".format(it) }
        }
        var filled = 0
        for (model in manifest["models"] as List<MutableMap<Any?, Any?>>) {
            if (devUrls != null) {
                val existing = (model["urls"] as List<*>).filterIsInstance<String>()
                val files = model["files"] as List<Map<*, *>>
                val modelDir = (files.first()["path"] as String).substringBefore('/')
                // dev-models.sh serves the local, engine-shaped tree
                // (asr-model/, final-model/, punctuation/). Keep the public
                // mirrors at repository root names via downloadPath, while
                // scoping this one LAN prefix to the matching local folder.
                val devPrefixes = devUrls.filterIsInstance<String>().map { raw ->
                    val prefix = if (raw.endsWith('/')) raw else "$raw/"
                    if (prefix.endsWith("$modelDir/")) prefix else "$prefix$modelDir/"
                }
                model["urls"] = devPrefixes + existing
            }
            for (file in model["files"] as List<MutableMap<Any?, Any?>>) {
                // An explicit LAN dev source is populated by dev-models.sh
                // with the extracted, digest-matched files. Keep directDebug
                // tests fast and local; production manifests retain the
                // official archive and never fall back to the mismatched HF
                // encoder object.
                if (devUrls != null && file.containsKey("archive")) {
                    file.remove("archive")
                }
                val local = File(modelsDir ?: repoModelsDir, "${file["path"]}")
                if (local.isFile) {
                    file["bytes"] = local.length()
                    file["sha256"] = sha256(local)
                    filled += 1
                }
            }
        }
        File(outDir, "manifest.json").writeText(
            groovy.json.JsonOutput.prettyPrint(groovy.json.JsonOutput.toJson(manifest)),
        )
        logger.lifecycle(
            "model manifest: $filled file digests filled from local copies" +
                if (devUrls != null) " (directDebug LAN URLs explicitly enabled)" else "",
        )
    }
}
tasks.named("preBuild") { dependsOn(generateModelManifest) }

android {
    namespace = "com.feelime.ime"
    compileSdk = 36
    // AGP's assetPacks set is bundle-global rather than flavor-scoped. Keep
    // the install-time pack declared unconditionally so every Play bundle
    // entry point (bundlePlay*, bundleRelease, and wrapper/CI invocations)
    // carries the model bytes. Direct distribution is shipped as APK only;
    // direct AAB tasks are rejected below instead of producing an ambiguous
    // AAB with a Play asset-pack dependency.
    assetPacks += listOf(":feelime-models")

    // Thin build (design §12.3): -PfeelimeModels=thin excludes the ~200MB ASR
    // models from assets (276MB -> 64MB APK); they then come from a
    // download source (ModelStore) instead of being packaged.
    // Default "full" keeps every existing script/output path unchanged;
    // the model files live in ~/.config/feelime/models (installed by
    // scripts/setup-assets.sh, never committed; in-tree fallback:
    // src/modelAssets/full).
    // The direct asset merge below declares this property and clears its
    // output when it changes, so full↔thin transitions cannot retain stale
    // model bytes in an incremental build.
    defaultConfig {
        applicationId = "com.feelime.ime"
        minSdk = 26
        targetSdk = 36
        versionCode = 49
        versionName = "1.0.19"

        ndk {
            abiFilters += "arm64-v8a"
        }
    }

    flavorDimensions += "distribution"
    productFlavors {
        create("direct") {
            dimension = "distribution"
            buildConfigField("boolean", "PLAY_DISTRIBUTION", "false")
        }
        create("play") {
            dimension = "distribution"
            buildConfigField("boolean", "PLAY_DISTRIBUTION", "true")
        }
    }

    sourceSets {
        if (modelPack == "full") {
            // Full model bytes belong to direct APKs only.  Play receives the
            // same tree through the install-time PAD pack below; keeping this
            // source set flavor-specific prevents duplicate bundle assets.
            getByName("direct") { modelsDir?.let { assets.srcDirs(it) } }
        }
        getByName("main") {
            // The sha-verified model manifest travels with
            // both build flavours (see generateModelManifest).
            assets.srcDir(modelManifestOut)
        }
    }

    buildFeatures {
        buildConfig = true
    }

    signingConfigs {
        if (releaseSigningConfigured) {
            create("feelimeRelease") {
                storeFile = File(releaseKeystorePath)
                storePassword = releaseStorePassword!!
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword!!
            }
        }
    }

    buildTypes {
        debug {
            // 与正式包共存（Play/直装 release 是 com.feelime.ime）：debug
            // 加 .dev 后缀 + 名称带 Dev（src/debug/res 覆盖，locale 语义
            // 正确），装机互不覆盖——Play 灰度装正式包后真机仍能装 debug
            // 迭代，两套数据目录独立。verify 套件的 PKG 解析跟随
            // （device_verify.py 探测逻辑）。
            applicationIdSuffix = ".dev"
            val debugKeystore = feelimeEnv("FEELIME_DEBUG_KEYSTORE")
            val debugStorePassword = feelimeEnv("FEELIME_DEBUG_STORE_PASSWORD")
            val debugKeyAlias = feelimeEnv("FEELIME_DEBUG_KEY_ALIAS")
            val debugKeyPassword = feelimeEnv("FEELIME_DEBUG_KEY_PASSWORD")
            if (debugKeystore != null && debugStorePassword != null &&
                debugKeyAlias != null && debugKeyPassword != null &&
                File(debugKeystore).isFile
            ) {
                val config = signingConfigs.create("feelimeDebug") {
                    storeFile = File(debugKeystore)
                    storePassword = debugStorePassword
                    keyAlias = debugKeyAlias
                    keyPassword = debugKeyPassword
                }
                config.enableV1Signing = true
                config.enableV2Signing = true
                signingConfig = config
            } else {
                // Keep the known-good debug signing setup used by asr-demo. AGP
                // emits a v2-signed APK for this minSdk, accepted by the test phone.
                signingConfig = signingConfigs.getByName("debug").apply {
                    enableV1Signing = true
                    enableV2Signing = true
                }
            }
        }
        release {
            // R8 minify + 资源收缩（Play App optimization）：keep 规则只保
            // 按名字/注解反射找代码的面（JNI 符号绑定、JS bridge、sherpa）。
            isMinifyEnabled = true
            isShrinkResources = true
            if (releaseSigningConfigured) {
                signingConfig = signingConfigs.getByName("feelimeRelease")
            }
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }

    androidResources {
        noCompress += listOf("onnx", "txt", "vocab")
    }

    packaging {
        jniLibs { useLegacyPackaging = true }
    }
}

// AGP's mergeAssets task does not treat an arbitrary Gradle property as an
// input. Bind the model mode explicitly and clear the merge output before a
// mode-changing execution; this makes a thin build safe immediately after a
// full build without requiring a manual clean.
tasks.configureEach {
    if (name == "mergeDirectDebugAssets" || name == "mergeDirectReleaseAssets" ||
        name == "packageDirectDebug" || name == "packageDirectRelease"
    ) {
        inputs.property("feelimeModels", modelPack)
    }
}

// AGP 8.10's CLEAN packager still opens an existing ZIP; removed model
// entries leave large unused regions. Recreate only the APK and package
// state on a model-mode switch. Ordinary asset edits keep incremental merge.
tasks.withType<com.android.build.gradle.tasks.PackageAndroidArtifact>().configureEach {
    if (name == "packageDirectDebug" || name == "packageDirectRelease") {
        val modeStamp = layout.buildDirectory.file("intermediates/feelime-model-mode/$name.txt")
        outputs.file(modeStamp).withPropertyName("feelimeModelMode")
        doFirst {
            val stamp = modeStamp.get().asFile
            if (!stamp.isFile || stamp.readText().trim() != modelPack) {
                outputDirectory.get().asFile.walkTopDown()
                    .filter { it.isFile && (it.extension == "apk" || it.name.endsWith(".apk.idsig")) }
                    .forEach { check(it.delete()) { "Cannot remove stale APK: $it" } }
                val state = incrementalFolder.get().asFile
                check(!state.exists() || state.deleteRecursively()) {
                    "Cannot reset APK packaging state: $state"
                }
                logger.lifecycle("$name: rebuilding APK for model mode $modelPack")
            }
        }
        doLast {
            modeStamp.get().asFile.apply {
                parentFile.mkdirs()
                writeText(modelPack)
            }
        }
    }
}

// Keep the pre-flavor verification command usable. AGP's flavor-aware
// variants are the source of truth; this lifecycle task deliberately runs
// both debug test suites so a generic `testDebugUnitTest` cannot silently
// validate only one distribution.
tasks.register("testDebugUnitTest") {
    group = "verification"
    description = "Runs directDebug and playDebug JVM unit tests."
    dependsOn("testDirectDebugUnitTest", "testPlayDebugUnitTest")
}

// `assembleDebug` remains AGP's aggregate task for both flavors.  Preserve
// the historical APK path consumed by the device scripts by copying the
// direct debug artifact after both flavor APKs have been assembled.  The
// flavor-specific paths remain the canonical outputs.
tasks.matching { it.name == "assembleDebug" }.configureEach {
    doLast {
        val directApk = layout.buildDirectory
            .file("outputs/apk/direct/debug/app-direct-debug.apk")
            .get().asFile
        check(directApk.isFile) { "missing direct debug APK: $directApk" }
        val legacyApk = layout.buildDirectory
            .file("outputs/apk/debug/app-debug.apk")
            .get().asFile
        legacyApk.parentFile.mkdirs()
        directApk.copyTo(legacyApk, overwrite = true)
        logger.lifecycle("legacy debug APK: ${legacyApk.relativeTo(projectDir)} (from directDebug)")
    }
}

tasks.configureEach {
    if (name == "bundleDirectDebug" || name == "bundleDirectRelease" ||
        name == "packageDirectDebugBundle" || name == "packageDirectReleaseBundle"
    ) {
    doFirst {
        throw GradleException(
            "direct AAB is unsupported: build :app:assembleDirectDebug/Release; " +
                "the install-time model pack is reserved for Play bundles",
        )
    }
    }
}

tasks.register("checkReleaseSigning") {
    group = "verification"
    description = "Fails unless release signing credentials are supplied through FEELIME_RELEASE_* environment variables."
    doLast {
        check(releaseSigningConfigured) {
            "Release signing is not configured; set FEELIME_RELEASE_KEYSTORE, " +
                "FEELIME_RELEASE_STORE_PASSWORD, FEELIME_RELEASE_KEY_ALIAS, and " +
                "FEELIME_RELEASE_KEY_PASSWORD. The current release artifact is unsigned and not publishable."
        }
        logger.lifecycle("release signing configured from FEELIME_RELEASE_* (keystore path withheld)")
    }
}

dependencies {
    // The sherpa-onnx AAR is machine-local (setup-assets.sh installs it to
    // ~/.config/feelime/android); the in-tree app/libs copy stays a fallback.
    val aarName = "sherpa-onnx-1.13.6.aar"
    val sharedAarDir = File(
        feelimeEnv("FEELIME_ANDROID_DIR")
            ?: (System.getProperty("user.home") + "/.config/feelime/android"),
    )
    val sherpaAar = sequenceOf(File(sharedAarDir, aarName), File(projectDir, "libs/$aarName"))
        .firstOrNull { it.isFile }
        ?: throw GradleException(
            "$aarName not found - run scripts/setup-assets.sh (installs to " +
                "~/.config/feelime/android) or place a copy in app/libs/",
        )
    implementation(files(sherpaAar))
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("org.apache.commons:commons-compress:1.28.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    testImplementation("junit:junit:4.13.2")
    // JVM tests cover org.json-based parsers (GithubReleaseSource) - the
    // spike project established this pattern.
    testImplementation("org.json:json:20240303")
}
