package expo.modules.floatingbubble

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class FloatingBubbleModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context indisponível" }

  override fun definition() = ModuleDefinition {
    Name("FloatingBubble")

    Function("canDrawOverlays") {
      Settings.canDrawOverlays(context)
    }

    // Abre a tela do sistema "Sobrepor a outros apps" já no app.
    Function("requestPermission") {
      val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${context.packageName}"))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    // `scheme` é o esquema de deep link do app (app.json → scheme), usado para abrir o link copiado.
    Function("start") { scheme: String ->
      if (!Settings.canDrawOverlays(context)) {
        throw CodedException("ERR_OVERLAY_PERMISSION", "Permissão para sobrepor a outros apps não concedida.", null)
      }
      BubbleService.saveScheme(context, scheme)
      ContextCompat.startForegroundService(context, Intent(context, BubbleService::class.java))
    }

    // Guarda o esquema de deep link para o "Compartilhar" funcionar mesmo sem a bolha ligada.
    Function("setScheme") { scheme: String ->
      BubbleService.saveScheme(context, scheme)
    }

    // Fecha a escolha de itens aberta pela bolha por cima de outro app.
    Function("closeOverlay") {
      OverlayActivity.close()
    }

    Function("stop") {
      context.stopService(Intent(context, BubbleService::class.java))
    }

    Function("isRunning") {
      BubbleService.running
    }
  }
}
