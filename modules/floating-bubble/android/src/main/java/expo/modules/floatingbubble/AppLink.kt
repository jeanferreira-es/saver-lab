package expo.modules.floatingbubble

import android.content.Context
import android.content.Intent
import android.net.Uri

/** Abre o app na aba Baixar com um link do Instagram (usado pela bolha e pelo compartilhar). */
object AppLink {
  private val INSTAGRAM_URL = Regex("""https://(www\.)?instagram\.com/(p|reel|reels|tv)/[\w-]+/?(\?\S*)?""", RegexOption.IGNORE_CASE)

  /** Primeiro link de post/reel/IGTV no texto, se houver. */
  fun find(text: String?): String? = text?.let { INSTAGRAM_URL.find(it)?.value }

  /**
   * Abre o deep link `<scheme>:///?url=...`. Retorna false se o esquema ainda não
   * é conhecido (o app nunca foi aberto desde a instalação).
   */
  fun open(context: Context, link: String): Boolean {
    val scheme = BubbleService.scheme(context) ?: return false
    // `t` força uma nova busca mesmo se o link se repetir.
    val uri = Uri.parse("$scheme:///?url=${Uri.encode(link)}&t=${System.currentTimeMillis()}")
    context.startActivity(
      Intent(Intent.ACTION_VIEW, uri).setPackage(context.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
    )
    return true
  }
}
