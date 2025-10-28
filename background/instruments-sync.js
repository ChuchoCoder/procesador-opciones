// Background service worker for daily instruments sync (MV3)
// This worker now imports the frontend sync service and runs it directly when the
// alarm fires. We keep the alarm creation minimal and call syncNow() when appropriate.

// Use the esbuild-produced bundle for the sync service to avoid duplicate source maintenance.
import syncService from './instrumentsSyncService.bundle.js';

const ALARM_NAME = 'daily-instruments-sync';

chrome.runtime.onInstalled.addListener(() => {
  // Create a daily alarm; periodInMinutes approximates 24h
  try {
    chrome.alarms.create(ALARM_NAME, { when: Date.now() + 1000 * 60, periodInMinutes: 24 * 60 });
    console.log('PO:instruments-sync - alarm created');
  } catch (e) {
    console.error('PO:instruments-sync - failed to create alarm', e);
  }
});

async function handleAlarm(alarm) {
  if (!alarm) return;
  if (alarm.name !== ALARM_NAME) return;

  console.info('PO:instruments-sync [INFO] background:alarm - alarm fired');

  try {
    // Check if we need to run (de-dup by day)
    let shouldRun = true;
      try {
      shouldRun = await syncService.shouldRunDailySync();
    } catch (e) {
      // On error, default to running once to be safe
      console.warn('PO:instruments-sync [WARN] background:shouldRunDailySync - error checking run condition', e && e.message);
      shouldRun = true;
    }

    if (!shouldRun) {
      logger.info('background', 'alarm', 'skip - already ran today');
      return;
    }

    // Execute sync now and log outcome
    const res = await syncService.syncNow();
    if (res && res.ok) {
      console.info('PO:instruments-sync [INFO] background:syncNow - sync completed', { parts: res.meta && res.meta.parts, fallback: res.fallback });
    } else {
      console.warn('PO:instruments-sync [WARN] background:syncNow - sync failed', { reason: res && res.reason });
    }
  } catch (e) {
    console.error('PO:instruments-sync [ERROR] background:alarm - unhandled error during sync', e && e.message);
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  // Fire-and-forget, but keep lifecycle safe by awaiting inside an async handler
  void handleAlarm(alarm);
});

// Graceful shutdown: nothing required for MV3 service worker
