package expo.modules.floatingbubble

import android.animation.ValueAnimator
import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.IBinder
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.Toast
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import kotlin.math.abs

/**
 * Serviço em primeiro plano que mantém a bolha sobre os outros apps.
 * Tocar na bolha abre a [ClipboardActivity]; segurar fecha a bolha;
 * arrastar até a borda de baixo esconde parte dela (um toque traz de volta).
 */
class BubbleService : Service() {
  private lateinit var windowManager: WindowManager
  private var bubble: View? = null
  private var tucked = false

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
    startInForeground()
    addBubble()
    running = true
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) stopSelf()
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    bubble?.let { windowManager.removeView(it) }
    bubble = null
    running = false
    super.onDestroy()
  }

  private fun startInForeground() {
    val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, "Balão flutuante", NotificationManager.IMPORTANCE_LOW)
      )
    }
    val stop = PendingIntent.getService(
      this,
      0,
      Intent(this, BubbleService::class.java).setAction(ACTION_STOP),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )
    val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_floating_bubble)
      .setContentTitle("Balão do Saver Lab ativo")
      .setContentText("Copie um link do Instagram e toque no balão.")
      .setOngoing(true)
      .addAction(0, "Fechar balão", stop)
      .build()
    val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
    } else {
      0
    }
    ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, type)
  }

  @SuppressLint("ClickableViewAccessibility")
  private fun addBubble() {
    val density = resources.displayMetrics.density
    val size = (56 * density).toInt()
    val padding = (14 * density).toInt()

    val view = FrameLayout(this).apply {
      background = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(BUBBLE_COLOR)
      }
      elevation = 6 * density
      contentDescription = "Baixar link copiado do Instagram"
      addView(
        ImageView(this@BubbleService).apply {
          setImageResource(R.drawable.ic_floating_bubble)
          setPadding(padding, padding, padding, padding)
        },
        FrameLayout.LayoutParams(size, size)
      )
    }

    val params = WindowManager.LayoutParams(
      size,
      size,
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
      PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      x = resources.displayMetrics.widthPixels - size
      y = resources.displayMetrics.heightPixels / 3
    }

    val slop = ViewConfiguration.get(this).scaledTouchSlop
    val longPress = ViewConfiguration.getLongPressTimeout().toLong()
    var startX = 0
    var startY = 0
    var touchX = 0f
    var touchY = 0f
    var dragging = false
    val closeOnHold = Runnable {
      if (!dragging) {
        Toast.makeText(this, "Balão fechado", Toast.LENGTH_SHORT).show()
        stopSelf()
      }
    }

    view.setOnTouchListener { v, event ->
      when (event.action) {
        MotionEvent.ACTION_DOWN -> {
          startX = params.x
          startY = params.y
          touchX = event.rawX
          touchY = event.rawY
          dragging = false
          if (!tucked) v.postDelayed(closeOnHold, longPress * 2)
        }
        MotionEvent.ACTION_MOVE -> {
          val dx = event.rawX - touchX
          val dy = event.rawY - touchY
          if (!dragging && (abs(dx) > slop || abs(dy) > slop)) {
            dragging = true
            v.removeCallbacks(closeOnHold)
            setTucked(v, false)
          }
          if (dragging) {
            params.x = startX + dx.toInt()
            params.y = startY + dy.toInt()
            windowManager.updateViewLayout(v, params)
          }
        }
        MotionEvent.ACTION_UP -> {
          v.removeCallbacks(closeOnHold)
          when {
            dragging && params.y + v.height > screenHeight() - v.height / 2 -> tuck(v, params)
            dragging -> snapToEdge(v, params)
            tucked -> untuck(v, params)
            running -> openClipboard()
          }
        }
        MotionEvent.ACTION_CANCEL -> v.removeCallbacks(closeOnHold)
      }
      true
    }

    windowManager.addView(view, params)
    bubble = view
  }

  // Ao soltar, a bolha encosta na borda mais próxima.
  private fun snapToEdge(view: View, params: WindowManager.LayoutParams) {
    val width = resources.displayMetrics.widthPixels
    val target = if (params.x + view.width / 2 < width / 2) 0 else width - view.width
    ValueAnimator.ofInt(params.x, target).apply {
      duration = 180
      addUpdateListener {
        if (bubble == null) return@addUpdateListener
        params.x = it.animatedValue as Int
        windowManager.updateViewLayout(view, params)
      }
      start()
    }
  }

  // Desce a bolha até sobrar só uma ponta na borda de baixo.
  private fun tuck(view: View, params: WindowManager.LayoutParams) {
    val width = resources.displayMetrics.widthPixels
    params.x = params.x.coerceIn(0, width - view.width)
    animateY(view, params, screenHeight() - (view.height * TUCKED_VISIBLE).toInt())
    setTucked(view, true)
  }

  private fun untuck(view: View, params: WindowManager.LayoutParams) {
    animateY(view, params, screenHeight() - (view.height * 2.5f).toInt())
    setTucked(view, false)
  }

  private fun setTucked(view: View, value: Boolean) {
    tucked = value
    view.animate().alpha(if (value) 0.6f else 1f).setDuration(180).start()
    view.contentDescription = if (value) "Mostrar balão" else "Baixar link copiado do Instagram"
  }

  private fun animateY(view: View, params: WindowManager.LayoutParams, target: Int) {
    ValueAnimator.ofInt(params.y, target).apply {
      duration = 200
      addUpdateListener {
        if (bubble == null) return@addUpdateListener
        params.y = it.animatedValue as Int
        windowManager.updateViewLayout(view, params)
      }
      start()
    }
  }

  private fun screenHeight(): Int =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      windowManager.currentWindowMetrics.bounds.height()
    } else {
      resources.displayMetrics.heightPixels
    }

  private fun openClipboard() {
    startActivity(
      Intent(this, ClipboardActivity::class.java).addFlags(
        Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_ANIMATION or Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS
      )
    )
  }

  companion object {
    @Volatile
    var running = false
      private set

    private const val CHANNEL_ID = "floating-bubble"
    private const val NOTIFICATION_ID = 4071
    private const val ACTION_STOP = "expo.modules.floatingbubble.STOP"
    private const val PREFS = "floating-bubble"
    private const val BUBBLE_COLOR = 0xFF5B3DF5.toInt()
    // Fração da bolha que continua visível quando escondida embaixo.
    private const val TUCKED_VISIBLE = 0.4f

    fun saveScheme(context: Context, scheme: String) {
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("scheme", scheme).apply()
    }

    fun scheme(context: Context): String? =
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("scheme", null)
  }
}
