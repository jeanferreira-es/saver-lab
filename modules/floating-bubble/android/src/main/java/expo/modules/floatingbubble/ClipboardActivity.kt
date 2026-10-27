package expo.modules.floatingbubble

import android.app.Activity
import android.content.ClipboardManager
import android.os.Bundle
import android.widget.Toast

/**
 * Tela transparente aberta ao tocar na bolha. O Android só deixa ler a área de
 * transferência com o app em foco, então esperamos o foco, lemos o link e saímos.
 */
class ClipboardActivity : Activity() {
  private var handled = false

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    overridePendingTransition(0, 0)
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (!hasFocus || handled) return
    handled = true

    val clipboard = getSystemService(CLIPBOARD_SERVICE) as ClipboardManager
    val text = clipboard.primaryClip?.takeIf { it.itemCount > 0 }?.getItemAt(0)?.coerceToText(this)?.toString()
    val link = AppLink.find(text)

    when {
      // Post: escolha dos itens por cima do app em uso, sem trazer o Saver Lab para frente.
      link != null && AppLink.isPost(link) -> OverlayActivity.open(this, link)
      // Story precisa da sessão da aba Navegar: abre o app.
      link != null && AppLink.open(this, link) -> Unit
      else -> Toast.makeText(this, "Nenhum link do Instagram copiado", Toast.LENGTH_SHORT).show()
    }
    finish()
    overridePendingTransition(0, 0)
  }
}
