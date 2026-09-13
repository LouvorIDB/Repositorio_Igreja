package com.liturge.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.webkit.WebView;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MediaNotificationService extends Service {
    public static final String CHANNEL_ID = "liturge_media_playback_v3";
    public static final int NOTIFICATION_ID = 1001;

    public static final String ACTION_START_OR_UPDATE = "com.liturge.app.ACTION_START_OR_UPDATE";
    public static final String ACTION_UPDATE_POSITION = "com.liturge.app.ACTION_UPDATE_POSITION";
    public static final String ACTION_UPDATE_ARTWORK = "com.liturge.app.ACTION_UPDATE_ARTWORK";
    public static final String ACTION_STOP = "com.liturge.app.ACTION_STOP";

    public static final String ACTION_PLAY_PAUSE = "com.liturge.app.ACTION_PLAY_PAUSE";
    public static final String ACTION_NEXT = "com.liturge.app.ACTION_NEXT";
    public static final String ACTION_PREV = "com.liturge.app.ACTION_PREV";

    public static final String EXTRA_TITLE = "extra_title";
    public static final String EXTRA_ARTIST = "extra_artist";
    public static final String EXTRA_ALBUM = "extra_album";
    public static final String EXTRA_DURATION = "extra_duration";
    public static final String EXTRA_POSITION = "extra_position";
    public static final String EXTRA_IS_PLAYING = "extra_is_playing";
    public static final String EXTRA_ARTWORK_URL = "extra_artwork_url";

    private static MediaNotificationService instance = null;
    private static WebView activeWebView = null;

    private MediaSession mediaSession;
    private NotificationManager notificationManager;

    private String currentTitle = "Liturge";
    private String currentArtist = "Louvor";
    private String currentAlbum = "Repertório Liturge";
    private long currentDurationMs = 0;
    private long currentPositionMs = 0;
    private boolean isPlaying = false;
    private Bitmap defaultArtworkBitmap = null;
    private Bitmap currentArtworkBitmap = null;
    private String currentArtworkUrl = null;

    private final ExecutorService imageExecutor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    public static void setWebView(WebView webView) {
        activeWebView = webView;
    }

    public static MediaNotificationService getInstance() {
        return instance;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        createNotificationChannel();
        initMediaSession();

        try {
            defaultArtworkBitmap = BitmapFactory.decodeResource(getResources(), R.drawable.liturge_cover);
        } catch (Exception ignored) {}

        if (defaultArtworkBitmap == null) {
            try {
                defaultArtworkBitmap = BitmapFactory.decodeResource(getResources(), R.mipmap.ic_launcher);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Remove canais legados com importância baixa para recriar com visibilidade ativa
            try {
                if (notificationManager != null) {
                    notificationManager.deleteNotificationChannel("liturge_media_channel");
                    notificationManager.deleteNotificationChannel("liturge_media_playback_channel_v2");
                }
            } catch (Exception ignored) {}

            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Reprodução de Áudio e VS",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            channel.setDescription("Controle de mídia Liturge em primeiro e segundo plano");
            channel.setShowBadge(true);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            channel.setSound(null, null); // Sem alerta sonoro para não tocar bipe por cima da música
            channel.enableVibration(false);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    private void initMediaSession() {
        mediaSession = new MediaSession(this, "LiturgeMediaSession");
        mediaSession.setFlags(MediaSession.FLAG_HANDLES_MEDIA_BUTTONS | MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS);
        mediaSession.setCallback(new MediaSession.Callback() {
            @Override
            public void onPlay() {
                dispatchToWeb("play");
            }

            @Override
            public void onPause() {
                dispatchToWeb("pause");
            }

            @Override
            public void onSkipToNext() {
                dispatchToWeb("next");
            }

            @Override
            public void onSkipToPrevious() {
                dispatchToWeb("prev");
            }

            @Override
            public void onSeekTo(long pos) {
                currentPositionMs = pos;
                updatePlaybackState();
                dispatchToWeb("seekTo:" + (pos / 1000.0));
            }

            @Override
            public void onStop() {
                dispatchToWeb("stop");
            }
        });
        mediaSession.setActive(true);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;

        String action = intent.getAction();
        if (ACTION_START_OR_UPDATE.equals(action)) {
            currentTitle = intent.getStringExtra(EXTRA_TITLE);
            if (currentTitle == null || currentTitle.trim().isEmpty()) currentTitle = "Música Liturge";

            currentArtist = intent.getStringExtra(EXTRA_ARTIST);
            if (currentArtist == null || currentArtist.trim().isEmpty()) currentArtist = "Liturge • Louvor";

            currentAlbum = intent.getStringExtra(EXTRA_ALBUM);
            if (currentAlbum == null || currentAlbum.trim().isEmpty()) currentAlbum = "Repertório";

            currentDurationMs = intent.getLongExtra(EXTRA_DURATION, 0);
            currentPositionMs = intent.getLongExtra(EXTRA_POSITION, 0);
            isPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, true);

            String newArtworkUrl = intent.getStringExtra(EXTRA_ARTWORK_URL);
            if (newArtworkUrl != null && !newArtworkUrl.trim().isEmpty()) {
                loadArtworkAsync(newArtworkUrl.trim());
            }

            updateMediaSessionMetadata();
            updatePlaybackState();
            showOrUpdateNotification();
        } else if (ACTION_UPDATE_ARTWORK.equals(action)) {
            String newArtworkUrl = intent.getStringExtra(EXTRA_ARTWORK_URL);
            if (newArtworkUrl != null && !newArtworkUrl.trim().isEmpty()) {
                loadArtworkAsync(newArtworkUrl.trim());
            }
        } else if (ACTION_UPDATE_POSITION.equals(action)) {
            currentPositionMs = intent.getLongExtra(EXTRA_POSITION, currentPositionMs);
            isPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, isPlaying);
            updatePlaybackState();
        } else if (ACTION_STOP.equals(action)) {
            stopPlaybackAndService();
        } else if (ACTION_PLAY_PAUSE.equals(action)) {
            dispatchToWeb("togglePlayPause");
        } else if (ACTION_NEXT.equals(action)) {
            dispatchToWeb("next");
        } else if (ACTION_PREV.equals(action)) {
            dispatchToWeb("prev");
        }

        return START_NOT_STICKY;
    }

    private void loadArtworkAsync(String urlStr) {
        if (urlStr == null || urlStr.trim().isEmpty()) return;
        if (urlStr.equals(currentArtworkUrl) && currentArtworkBitmap != null) {
            return;
        }

        imageExecutor.execute(() -> {
            HttpURLConnection conn = null;
            InputStream in = null;
            try {
                URL url = new URL(urlStr);
                conn = (HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(6000);
                conn.setReadTimeout(6000);
                conn.setInstanceFollowRedirects(true);
                conn.connect();

                if (conn.getResponseCode() == HttpURLConnection.HTTP_OK) {
                    in = conn.getInputStream();
                    Bitmap decoded = BitmapFactory.decodeStream(in);
                    if (decoded != null) {
                        int maxDim = 720;
                        if (decoded.getWidth() > maxDim || decoded.getHeight() > maxDim) {
                            float scale = Math.min((float) maxDim / decoded.getWidth(), (float) maxDim / decoded.getHeight());
                            int newW = Math.round(decoded.getWidth() * scale);
                            int newH = Math.round(decoded.getHeight() * scale);
                            decoded = Bitmap.createScaledBitmap(decoded, newW, newH, true);
                        }

                        final Bitmap finalBitmap = decoded;
                        currentArtworkBitmap = finalBitmap;
                        currentArtworkUrl = urlStr;

                        mainHandler.post(() -> {
                            updateMediaSessionMetadata();
                            showOrUpdateNotification();
                        });
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
            } finally {
                if (in != null) {
                    try { in.close(); } catch (Exception ignored) {}
                }
                if (conn != null) {
                    conn.disconnect();
                }
            }
        });
    }

    private void updateMediaSessionMetadata() {
        if (mediaSession == null) return;

        MediaMetadata.Builder builder = new MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE, currentTitle)
            .putString(MediaMetadata.METADATA_KEY_ARTIST, currentArtist)
            .putString(MediaMetadata.METADATA_KEY_ALBUM, currentAlbum)
            .putLong(MediaMetadata.METADATA_KEY_DURATION, currentDurationMs);

        Bitmap artToUse = (currentArtworkBitmap != null) ? currentArtworkBitmap : defaultArtworkBitmap;
        if (artToUse != null) {
            builder.putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, artToUse);
            builder.putBitmap(MediaMetadata.METADATA_KEY_ART, artToUse);
        }

        mediaSession.setMetadata(builder.build());
    }

    private void updatePlaybackState() {
        if (mediaSession == null) return;

        int state = isPlaying ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED;
        long actions = PlaybackState.ACTION_PLAY |
                       PlaybackState.ACTION_PAUSE |
                       PlaybackState.ACTION_PLAY_PAUSE |
                       PlaybackState.ACTION_SKIP_TO_NEXT |
                       PlaybackState.ACTION_SKIP_TO_PREVIOUS |
                       PlaybackState.ACTION_SEEK_TO |
                       PlaybackState.ACTION_STOP;

        PlaybackState.Builder stateBuilder = new PlaybackState.Builder()
            .setActions(actions)
            .setState(state, currentPositionMs, isPlaying ? 1.0f : 0.0f);

        mediaSession.setPlaybackState(stateBuilder.build());
    }

    private void showOrUpdateNotification() {
        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
        }

        Intent openAppIntent = new Intent(this, MainActivity.class);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openAppPendingIntent = PendingIntent.getActivity(
            this, 0, openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        PendingIntent prevPI = PendingIntent.getService(
            this, 1, new Intent(this, MediaNotificationService.class).setAction(ACTION_PREV),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        PendingIntent playPausePI = PendingIntent.getService(
            this, 2, new Intent(this, MediaNotificationService.class).setAction(ACTION_PLAY_PAUSE),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        PendingIntent nextPI = PendingIntent.getService(
            this, 3, new Intent(this, MediaNotificationService.class).setAction(ACTION_NEXT),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        builder.setContentTitle(currentTitle)
            .setContentText(currentArtist)
            .setSubText(currentAlbum)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(openAppPendingIntent)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setCategory(Notification.CATEGORY_TRANSPORT)
            .setOngoing(isPlaying)
            .setOnlyAlertOnce(true);

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            builder.setPriority(Notification.PRIORITY_HIGH);
        }

        Bitmap artToUse = (currentArtworkBitmap != null) ? currentArtworkBitmap : defaultArtworkBitmap;
        if (artToUse != null) {
            builder.setLargeIcon(artToUse);
        }

        builder.addAction(new Notification.Action.Builder(
            android.R.drawable.ic_media_previous, "Anterior", prevPI).build());

        builder.addAction(new Notification.Action.Builder(
            isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
            isPlaying ? "Pausar" : "Tocar", playPausePI).build());

        builder.addAction(new Notification.Action.Builder(
            android.R.drawable.ic_media_next, "Próxima", nextPI).build());

        if (mediaSession != null) {
            Notification.MediaStyle mediaStyle = new Notification.MediaStyle()
                .setMediaSession(mediaSession.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2);
            builder.setStyle(mediaStyle);
        }

        Notification notification = builder.build();

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
            // Força a publicação imediata da notificação no NotificationManager para que apareça na barra sem atraso
            if (notificationManager != null) {
                notificationManager.notify(NOTIFICATION_ID, notification);
            }
        } catch (Exception e) {
            e.printStackTrace();
            if (notificationManager != null) {
                notificationManager.notify(NOTIFICATION_ID, notification);
            }
        }
    }

    private void stopPlaybackAndService() {
        currentArtworkBitmap = null;
        currentArtworkUrl = null;
        if (mediaSession != null) {
            mediaSession.setActive(false);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
        if (notificationManager != null) {
            notificationManager.cancel(NOTIFICATION_ID);
        }
        stopSelf();
    }

    public static void dispatchToWeb(String command) {
        if (activeWebView != null) {
            activeWebView.post(() -> {
                if ("play".equals(command)) {
                    activeWebView.evaluateJavascript("window.LiturgePlayer && window.LiturgePlayer.togglePlayPause && window.LiturgePlayer.togglePlayPause(true)", null);
                } else if ("pause".equals(command)) {
                    activeWebView.evaluateJavascript("window.LiturgePlayer && window.LiturgePlayer.togglePlayPause && window.LiturgePlayer.togglePlayPause(false)", null);
                } else if ("togglePlayPause".equals(command)) {
                    activeWebView.evaluateJavascript("window.LiturgePlayer && window.LiturgePlayer.togglePlayPause && window.LiturgePlayer.togglePlayPause()", null);
                } else if ("next".equals(command)) {
                    activeWebView.evaluateJavascript("window.LiturgePlayer && window.LiturgePlayer.tocarProxima && window.LiturgePlayer.tocarProxima()", null);
                } else if ("prev".equals(command)) {
                    activeWebView.evaluateJavascript("window.LiturgePlayer && window.LiturgePlayer.tocarAnterior && window.LiturgePlayer.tocarAnterior()", null);
                } else if ("stop".equals(command)) {
                    activeWebView.evaluateJavascript("window.LiturgePlayer && window.LiturgePlayer.fechar && window.LiturgePlayer.fechar()", null);
                } else if (command.startsWith("seekTo:")) {
                    String sec = command.substring(7);
                    activeWebView.evaluateJavascript("window.LiturgePlayer && window.LiturgePlayer.seekTo && window.LiturgePlayer.seekTo(" + sec + ")", null);
                }
            });
        }
    }

    @Override
    public void onDestroy() {
        if (mediaSession != null) {
            mediaSession.release();
            mediaSession = null;
        }
        instance = null;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
