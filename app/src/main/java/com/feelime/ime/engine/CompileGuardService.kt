package com.feelime.ime.engine

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat

/**
 * 词库编译的保活前台服务（#35 ace 实录）：设备端 librime maintenance 是
 * 分钟级批处理（万象 Lite 6 项清单真机 >10min），跑在设置页进程的 worker
 * 线程上。设置页一旦退到后台（用户灭屏/切走），ColorOS 等厂商系统会在
 * 数分钟后静默清掉整个进程（am_proc_died 无 crash 记录），编译中断由
 * sweepPending 回滚——用户等十分钟只换来失败。FGS 把进程提为前台服务
 * 优先级，编译期间系统不再回收（普通 ROM 同样受益：LMK 不再选中它）。
 *
 * 生命周期跟着 BaseDictInstaller 的 worker：编译入口 start、收尾 stop，
 * 进程被杀时服务随之消失（START_NOT_STicky——中断回滚机制本来就是
 * 兜底，不需要自动重启续跑）。
 */
class CompileGuardService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // codex 三轮 P2-4：升前台被系统拒（如后台态启动的临时许可过期）会
        // 在主线程抛 ForegroundServiceStartNotAllowedException 直接崩进程
        // ——接住并自灭，编译降级为无保活继续跑（与 start() 被拒同语义）。
        runCatching { startInForeground() }
            .onFailure {
                android.util.Log.w("FeelimeBaseDict", "compile guard fg: ${it.message}")
                stopSelf()
            }
        return START_NOT_STICKY
    }

    private fun startInForeground() {
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                getString(com.feelime.ime.R.string.dict_compile_channel),
                NotificationManager.IMPORTANCE_LOW,
            ),
        )
        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(com.feelime.ime.R.drawable.ic_tile_feelime)
            .setContentTitle(getString(com.feelime.ime.R.string.dict_compile_title))
            .setOngoing(true)
            .build()
        val type = if (Build.VERSION.SDK_INT >= 34) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
        } else {
            0
        }
        ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, type)
    }

    companion object {
        private const val CHANNEL_ID = "dict_compile"
        private const val NOTIFICATION_ID = 42

        /** 编译入口调；已在跑（重复导入/补偿补编）时幂等。 */
        fun start(context: Context) {
            runCatching {
                ContextCompat.startForegroundService(
                    context,
                    Intent(context, CompileGuardService::class.java),
                )
            }.onFailure {
                android.util.Log.w("FeelimeBaseDict", "compile guard: ${it.message}")
            }
        }

        fun stop(context: Context) {
            runCatching { context.stopService(Intent(context, CompileGuardService::class.java)) }
        }
    }
}
