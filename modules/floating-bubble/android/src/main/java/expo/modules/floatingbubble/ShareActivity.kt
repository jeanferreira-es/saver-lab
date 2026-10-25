package expo.modules.floatingbubble

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.widget.Toast

/**
 * Tela transparente que coloca o app na lista de "Compartilhar" do Android para
 * textos/links. Lê o link compartilhado, abre o app na aba Baixar e sai.
 */
class ShareActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    overridePendingTransition(0, 0)

    val text = intent.takeIf { it.action == Intent.ACTION_SEND }?.let {
      it.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString() ?: it.getStringExtra(Intent.EXTRA_SUBJECT)
    }
    val link = AppLink.find(text)

    when {
      link == null -> Toast.makeText(this, "Nenhum link de post ou reel do Instagram", Toast.LENGTH_SHORT).show()
      !AppLink.open(this, link) -> Toast.makeText(this, "Abra o Saver Lab uma vez e compartilhe de novo", Toast.LENGTH_LONG).show()
    }
    finish()
    overridePendingTransition(0, 0)
  }
}
