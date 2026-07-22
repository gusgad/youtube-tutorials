# Web Locks API Demo

A minimal demo of the [Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API),
based on the scenario in [OLX Tech's article](https://tech.olx.com/handling-concurrency-on-the-web-with-web-locks-api-163b7e07eddd):
coordinating a task across multiple open browser tabs so only one tab runs it at a time.

Plain HTML/CSS/JS, no build step.

## Run it

Locks require a secure context and same-origin tabs, so serve it over `http://localhost` rather than opening
`index.html` directly:

```sh
python3 -m http.server 5173
```

Open **http://localhost:5173** in two tabs, then click **Start Upload** in both. Only one tab acquires the lock
and uploads (5 seconds, with a progress bar); the other immediately sees the lock is taken and skips.

## How it works

`app.js` requests a named lock non-blockingly:

```js
navigator.locks.request(LOCK_NAME, { ifAvailable: true }, async (lock) => {
  if (!lock) {
    // another tab already holds it — skip
    return;
  }
  // this tab holds the lock — do the work, then release automatically
});
```
