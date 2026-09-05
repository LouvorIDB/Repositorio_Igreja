package com.liturge.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.webkit.JavascriptInterface;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileOutputStream;

public class CalendarExportInterface {
    private final Context context;

    public CalendarExportInterface(Context context) {
        this.context = context;
    }

    @JavascriptInterface
    public boolean abrirNoCalendarioNativo(String icsContent, String fileName) {
        try {
            if (icsContent == null || icsContent.trim().isEmpty()) {
                return false;
            }

            String validFileName = (fileName != null && !fileName.trim().isEmpty()) ? fileName.trim() : "agenda_cultos.ics";
            if (!validFileName.endsWith(".ics")) {
                validFileName += ".ics";
            }

            File cacheFolder = new File(context.getCacheDir(), "calendario");
            if (!cacheFolder.exists()) {
                cacheFolder.mkdirs();
            }

            File icsFile = new File(cacheFolder, validFileName);
            try (FileOutputStream fos = new FileOutputStream(icsFile)) {
                fos.write(icsContent.getBytes("UTF-8"));
                fos.flush();
            }

            Uri contentUri = FileProvider.getUriForFile(
                context,
                context.getPackageName() + ".fileprovider",
                icsFile
            );

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(contentUri, "text/calendar");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            Intent chooser = Intent.createChooser(intent, "Adicionar ao Calendário");
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(chooser);
            return true;
        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }
    }
}
