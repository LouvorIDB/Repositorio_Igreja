package com.liturge.app;

import android.os.Bundle;
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

        // Interface nativa para abrir arquivos .ics diretamente no app de calendário do celular
        registrarInterfaceCalendario();
    }

    @Override
    public void onStart() {
        super.onStart();
        registrarInterfaceCalendario();
    }

    private void registrarInterfaceCalendario() {
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().addJavascriptInterface(new CalendarExportInterface(this), "AndroidCalendar");
        }
    }
}
