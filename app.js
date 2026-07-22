const btn = document.getElementById("btn");
const progress = document.getElementById("progress");
const status = document.getElementById("status");
const LOCK_NAME = "upload-lock";
const UPLOAD_DURATION_MS = 8000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

if (!("locks" in navigator)) {
  status.textContent = "Web Locks API is not supported in this browser.";
  btn.disabled = true;
} else {
  btn.addEventListener("click", async () => {
    btn.disabled = true;

    await navigator.locks.request(LOCK_NAME, { ifAvailable: true }, async (lock) => {
      if (!lock) {
        status.textContent = "Already uploading in another tab — skipped.";
        return;
      }

      const start = Date.now();
      while (Date.now() - start < UPLOAD_DURATION_MS) {
        const pct = Math.min(100, Math.round(((Date.now() - start) / UPLOAD_DURATION_MS) * 100));
        progress.value = pct;
        status.textContent = `Uploading... ${pct}%`;
        await sleep(100);
      }

      progress.value = 100;
      status.textContent = "Upload complete.";
    });

    btn.disabled = false;
  });
}
