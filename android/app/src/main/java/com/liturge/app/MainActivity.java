package com.liturge.app;

import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Garante que o WebView respeite rigorosamente a barra de notificações,
        // o recorte físico da câmera frontal (display cutout) e a barra de navegação/gestos.
        // Quando o teclado virtual (IME) estiver aberto, o adjustResize do Android já ajusta a janela;
        // portanto, zeramos o bottomPadding para não colapsar a altura do WebView.
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(android.R.id.content), (view, windowInsets) -> {
            Insets insets = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            boolean isImeVisible = windowInsets.isVisible(WindowInsetsCompat.Type.ime());
            int bottomPadding = isImeVisible ? 0 : insets.bottom;
            view.setPadding(insets.left, insets.top, insets.right, bottomPadding);
            return windowInsets;
        });

        // Configura a interceptação nativa do botão e gesto "Voltar" (Android 14 / One UI / Galaxy S24)
        configurarBotaoVoltarNativo();

        // Solicita permissão de notificação nativa no Android 13+ (One UI / Galaxy S24)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 101);
            }
        }

        // Interfaces nativas (Calendário e Controle Multimídia em 2º plano)
        registrarInterfacesNativas();
    }

    private void configurarBotaoVoltarNativo() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    android.webkit.WebView webView = getBridge().getWebView();
                    webView.evaluateJavascript(
                        "(function() {" +
                        "  if (typeof window.tratarBotaoVoltarNativo === 'function') {" +
                        "    return window.tratarBotaoVoltarNativo();" +
                        "  }" +
                        "  return 'DEFAULT';" +
                        "})();",
                        value -> {
                            if ("\"EXIT\"".equals(value) || "\"DEFAULT\"".equals(value) || value == null) {
                                setEnabled(false);
                                getOnBackPressedDispatcher().onBackPressed();
                                setEnabled(true);
                            }
                        }
                    );
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                    setEnabled(true);
                }
            }
        });
    }

    @Override
    public void onStart() {
        super.onStart();
        registrarInterfacesNativas();
    }

    @Override
    public void onDestroy() {
        MediaNotificationService.setWebView(null);
        super.onDestroy();
    }

    private void registrarInterfacesNativas() {
        if (getBridge() != null && getBridge().getWebView() != null) {
            android.webkit.WebView webView = getBridge().getWebView();
            webView.addJavascriptInterface(new CalendarExportInterface(this), "AndroidCalendar");
            webView.addJavascriptInterface(new MediaBridgeInterface(this), "AndroidMedia");
            MediaNotificationService.setWebView(webView);
        }
    }
}
