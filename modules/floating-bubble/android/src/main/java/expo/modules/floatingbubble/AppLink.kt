package expo.modules.floatingbubble

import android.content.Context
import android.content.Intent
import android.net.Uri

/** Abre o app na aba Baixar com um link do Instagram, do Threads, do TikTok ou do X (usado pela bolha e pelo compartilhar). */
object AppLink {
  // Posts, reels, IGTV, stories (`/stories/<usuário>/<id>`, `/stories/highlights/<id>`)
  // e destaques compartilhados pelo app oficial (`/s/<código>?story_media_id=...`).
  private val INSTAGRAM_URL = Regex(
    """https://(www\.)?instagram\.com/((p|reel|reels|tv)/[\w-]+|stories/[\w.]+(/\d+)?|stories/highlights/\d+|s/[\w=-]+)/?(\?\S*)?""",
    RegexOption.IGNORE_CASE,
  )

  // Posts do Threads: `threads.com` ou o domínio antigo `threads.net`, com o usuário ou `/t/<código>`.
  private val THREADS_URL = Regex(
    """https://(www\.)?threads\.(com|net)/(@[\w.]+/post|t)/[\w-]+\S*""",
    RegexOption.IGNORE_CASE,
  )

  // Vídeos e fotos, inclusive os links curtos que o botão de compartilhar do TikTok gera.
  private val TIKTOK_URL = Regex(
    """https://((vm|vt)\.tiktok\.com/[\w-]+|(www\.|m\.)?tiktok\.com/(t/[\w-]+|@[\w.-]+/(video|photo)/\d+))/?(\?\S*)?""",
    RegexOption.IGNORE_CASE,
  )

  // Tweets: `x.com` ou `twitter.com`, com o usuário ou `/i/status/<id>`, com ou sem `/photo/1` e parâmetros.
  private val TWITTER_URL = Regex(
    """https://((www|mobile)\.)?(x|twitter)\.com/(i/(web/)?|\w{1,15}/)status(es)?/\d+\S*""",
    RegexOption.IGNORE_CASE,
  )

  private val POST_URL = Regex("""instagram\.com/([\w.]+/)?(p|reel|reels|tv)/""", RegexOption.IGNORE_CASE)

  /** Post, reel ou IGTV do Instagram (stories, Threads, TikTok e X são baixados pela página do site, dentro do app). */
  fun isPost(link: String): Boolean = POST_URL.containsMatchIn(link)

  /** Primeiro link de post/reel/IGTV/story, post do Threads, vídeo do TikTok ou tweet no texto, se houver. */
  fun find(text: String?): String? = text?.let {
    (INSTAGRAM_URL.find(it) ?: THREADS_URL.find(it) ?: TIKTOK_URL.find(it) ?: TWITTER_URL.find(it))?.value
  }

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
