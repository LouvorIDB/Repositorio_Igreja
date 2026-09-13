package com.liturge.app;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.webkit.JavascriptInterface;
import android.Manifest;

public class MediaBridgeInterface {
    private final Activity activity;

    public MediaBridgeInterface(Activity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public void updateMedia(String title, String artist, String album, double durationSec, double positionSec, boolean isPlaying) {
        try {
            android.content.Context ctx = (activity != null) ? activity.getApplicationContext() : null;
            if (ctx == null) return;

            Intent intent = new Intent(ctx, MediaNotificationService.class);
            intent.setAction(MediaNotificationService.ACTION_START_OR_UPDATE);
            intent.putExtra(MediaNotificationService.EXTRA_TITLE, title);
            intent.putExtra(MediaNotificationService.EXTRA_ARTIST, artist);
            intent.putExtra(MediaNotificationService.EXTRA_ALBUM, album);
            intent.putExtra(MediaNotificationService.EXTRA_DURATION, (long) (durationSec * 1000));
            intent.putExtra(MediaNotificationService.EXTRA_POSITION, (long) (positionSec * 1000));
            intent.putExtra(MediaNotificationService.EXTRA_IS_PLAYING, isPlaying);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(intent);
            } else {
                ctx.startService(intent);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @JavascriptInterface
    public void updatePosition(double positionSec, boolean isPlaying) {
        try {
            android.content.Context ctx = (activity != null) ? activity.getApplicationContext() : null;
            if (ctx == null) return;

            Intent intent = new Intent(ctx, MediaNotificationService.class);
            intent.setAction(MediaNotificationService.ACTION_UPDATE_POSITION);
            intent.putExtra(MediaNotificationService.EXTRA_POSITION, (long) (positionSec * 1000));
            intent.putExtra(MediaNotificationService.EXTRA_IS_PLAYING, isPlaying);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(intent);
            } else {
                ctx.startService(intent);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @JavascriptInterface
    public void stopMedia() {
        try {
            android.content.Context ctx = (activity != null) ? activity.getApplicationContext() : null;
            if (ctx == null) return;

            Intent intent = new Intent(ctx, MediaNotificationService.class);
            intent.setAction(MediaNotificationService.ACTION_STOP);
            ctx.startService(intent);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @JavascriptInterface
    public void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                activity.requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 101);
            }
        }
    }
}
