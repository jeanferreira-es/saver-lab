package expo.modules.floatingbubble

import android.content.Context
import android.content.Intent
import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultReactActivityDelegate
import java.lang.ref.WeakReference

/**
 * Tela transparente com a escolha dos itens de um post, aberta pela bolha por cima
 * do app em uso (o Instagram continua visível atrás). Roda o componente JS
 * "SaverLabOverlay", no mesmo JS do app: mesmo histórico, downloads e cache de posts.
 */
class OverlayActivity : ReactActivity() {
  override fun getMainComponentName(): String = COMPONENT

  override fun createReactActivityDelegate(): ReactActivityDelegate =
    object : DefaultReactActivityDelegate(this, COMPONENT) {
      override fun getLaunchOptions(): Bundle =
        Bundle().apply { putString("url", this@OverlayActivity.intent.getStringExtra(EXTRA_URL)) }
    }

  override fun onCreate(savedInstanceState: Bundle?) {
    // null: a tela sempre começa do link recebido, nunca de um estado salvo.
    super.onCreate(null)
    current = WeakReference(this)
    overridePendingTransition(0, 0)
  }

  // Outro link com a tela já aberta: recomeça com ele.
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    recreate()
  }

  override fun finish() {
    super.finish()
    overridePendingTransition(0, 0)
  }

  companion object {
    private const val COMPONENT = "SaverLabOverlay"
    private const val EXTRA_URL = "url"
    private var current: WeakReference<OverlayActivity>? = null

    fun open(context: Context, link: String) {
      context.startActivity(
        Intent(context, OverlayActivity::class.java)
          .putExtra(EXTRA_URL, link)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_ANIMATION),
      )
    }

    fun close() {
      current?.get()?.finish()
    }
  }
}
