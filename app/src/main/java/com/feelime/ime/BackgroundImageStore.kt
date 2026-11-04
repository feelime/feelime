package com.feelime.ime

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.webkit.WebResourceResponse
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File

/** 背景文件原字节服务，不重编码已导入的图片。版本只在文件换装时变化。 */
internal object BackgroundImageStore {
    const val PREFIX = "/keyboard/background/"
    const val HOST = "feelime.local"
    val requests = BackgroundImageRequests()

    @Synchronized fun url(context: Context, variant: String): String {
        val file = bgImageFile(context, variant)
        if (!file.isFile) return ""
        val version = context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
            .getString("bg_image_${variant}_version", null) ?: "${file.lastModified()}-${file.length()}"
        return "https://$HOST$PREFIX$variant/$version.jpg"
    }

    @Synchronized fun response(context: Context, path: String): WebResourceResponse? {
        val variant = path.removePrefix(PREFIX).substringBefore('/')
        if (!isValidBgVariant(variant) || path != android.net.Uri.parse(url(context, variant)).path) return null
        return runCatching {
            WebResourceResponse("image/jpeg", null, 200, "OK",
                mapOf("Cache-Control" to "no-cache"), bgImageFile(context, variant).inputStream())
        }.getOrNull()
    }

    @Synchronized fun install(context: Context, variant: String, bytes: ByteArray) {
        require(isValidBgVariant(variant))
        val target = bgImageFile(context, variant)
        val temp = File(target.parentFile, "${target.name}.tmp")
        try {
            temp.outputStream().use { it.write(bytes) }
            check(temp.renameTo(target))
            context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE).edit()
                .putString("bg_image_${variant}_version", java.util.UUID.randomUUID().toString()).commit()
        } finally { temp.delete() }
    }

    /** 先读尺寸并计算采样，不能先解完整原图再缩小。EXIF 朝向沿用浏览器口径。 */
    fun decodeImport(bytes: ByteArray): ByteArray {
        require(bytes.size <= 16 * 1024 * 1024)
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        val orientation = runCatching {
            ExifInterface(ByteArrayInputStream(bytes)).getAttributeInt(ExifInterface.TAG_ORIENTATION, 1)
        }.getOrDefault(1)
        val rotated = orientation in 5..8
        val width = if (rotated) bounds.outHeight else bounds.outWidth
        val height = if (rotated) bounds.outWidth else bounds.outHeight
        val size = importSize(width, height)
        val rawWidth = if (rotated) size.second else size.first
        val rawHeight = if (rotated) size.first else size.second
        val sample = importSample(bounds.outWidth, bounds.outHeight, rawWidth, rawHeight)
        checkImportDecodeBudget(bounds.outWidth, bounds.outHeight, sample)
        val decoded = checkNotNull(BitmapFactory.decodeByteArray(bytes, 0, bytes.size,
            BitmapFactory.Options().apply { inSampleSize = sample; inPreferredConfig = Bitmap.Config.ARGB_8888 }))
        var oriented: Bitmap? = null
        var scaled: Bitmap? = null
        try {
            val matrix = Matrix().apply {
                when (orientation) {
                    2 -> setScale(-1f, 1f)
                    3 -> setRotate(180f)
                    4 -> setScale(1f, -1f)
                    5 -> { setRotate(90f); postScale(-1f, 1f) }
                    6 -> setRotate(90f)
                    7 -> { setRotate(-90f); postScale(-1f, 1f) }
                    8 -> setRotate(-90f)
                }
            }
            oriented = Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, matrix, true)
            scaled = Bitmap.createScaledBitmap(oriented, size.first, size.second, true)
            return ByteArrayOutputStream().use { output ->
                check(scaled.compress(Bitmap.CompressFormat.JPEG, 72, output))
                output.toByteArray()
            }
        } finally {
            scaled?.takeIf { it !== oriented && it !== decoded }?.recycle()
            oriented?.takeIf { it !== decoded }?.recycle()
            decoded.recycle()
        }
    }

    internal fun importSample(width: Int, height: Int, targetWidth: Int, targetHeight: Int): Int {
        require(width > 0 && height > 0 && targetWidth > 0 && targetHeight > 0)
        var sample = 1
        // 解码短边最少为一像素，不能挡住长边采样；已达到目标后停止，避免无效倍增。
        while (sample <= Int.MAX_VALUE / 2 && (width / sample > targetWidth || height / sample > targetHeight)) {
            val next = sample * 2
            if (maxOf(1, width / next) < targetWidth || maxOf(1, height / next) < targetHeight) break
            sample = next
        }
        return sample
    }

    internal fun checkImportDecodeBudget(width: Int, height: Int, sample: Int) {
        require(width > 0 && height > 0 && sample > 0)
        // 向上取整覆盖解码器的余数像素；二次幂采样允许目标各边不足两倍的中间图。
        // 必须在分配前检查，不能只检查最终缩放后的尺寸。
        val decodedWidth = (width.toLong() + sample - 1) / sample
        val decodedHeight = (height.toLong() + sample - 1) / sample
        require(maxOf(decodedWidth, decodedHeight) <= 8192 && decodedWidth * decodedHeight <= 12_000_000) {
            "image exceeds decode pixel budget"
        }
    }

    internal fun importSize(width: Int, height: Int): Pair<Int, Int> {
        require(width > 0 && height > 0)
        val scale = minOf(1.0, 720.0 / width)
        val w = maxOf(1, kotlin.math.floor(width * scale + 0.5).toInt())
        val h = maxOf(1, kotlin.math.floor(height * scale + 0.5).toInt())
        // 不改变已确认的显示比例；过长的图交给用户先行处理。
        require(maxOf(w, h) <= 4096 && w.toLong() * h <= 3_000_000) { "image exceeds pixel budget" }
        return w to h
    }
}
