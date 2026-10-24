package expo.modules.floatingbubble

import android.app.Activity
import android.content.ClipboardManager
import android.content.Intent
import android.net.Uri
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
    val link = text?.let { INSTAGRAM_URL.find(it)?.value }
    val scheme = BubbleService.scheme(this)

    if (link != null && scheme != null) {
      // Abre o app na aba Baixar já com o link; `t` força uma nova busca mesmo se o link se repetir.
      val uri = Uri.parse("$scheme:///?url=${Uri.encode(link)}&t=${System.currentTimeMillis()}")
      startActivity(Intent(Intent.ACTION_VIEW, uri).setPackage(packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    } else {
      Toast.makeText(this, "Nenhum link do Instagram copiado", Toast.LENGTH_SHORT).show()
    }
    finish()
    overridePendingTransition(0, 0)
  }

  companion object {
    private val INSTAGRAM_URL = Regex("""https://(www\.)?instagram\.com/(p|reel|reels|tv)/[\w-]+/?(\?\S*)?""", RegexOption.IGNORE_CASE)
  }
}
