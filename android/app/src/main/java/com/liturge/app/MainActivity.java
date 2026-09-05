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
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(android.R.id.content), (view, windowInsets) -> {
            Insets insets = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            view.setPadding(insets.left, insets.top, insets.right, insets.bottom);
            return WindowInsetsCompat.CONSUMED;
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
