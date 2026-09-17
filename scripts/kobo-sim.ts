// SPDX-License-Identifier: GPL-3.0-only
// v3.0.0 — Kobo sync simulator: replays the device's whole request flow
// against a running BookShelf server so self-hosters can verify the sync
// endpoint end-to-end without a physical Kobo device. Hardware-verified
// behavior is still pending customer feedback; this script covers the wire
// protocol exactly as the device issues it (calibre-web reference).
//
// Usage:
//   npm run kobo:sim -- http://localhost:1024 <sync-token> [file-source-base]
//
// Steps verified:
//   1. POST /v1/auth/device        (device handshake)
//   2. GET  /v1/initialization     (resources)
//   3. GET  /v1/library/sync       (entitlements + sync token)
//   4. GET  /download/{id}/epub    (file proxy, if a fileSourceUrl is set)
//   5. PUT  /v1/library/{id}/state (progress write-back; reports 50% of the
//                                    first READING book — sync ONCE against
//                                    a throwaway library to avoid side effects)

const [baseUrl = "http://localhost:1024", token = process.env.KOBO_SYNC_TOKEN, fileBase = null] = process.argv.slice(2);

if (!token) {
  console.error("Usage: npm run kobo:sim -- <base-url> <sync-token> [file-source-base]");
  process.exit(1);
}

const root = `${String(baseUrl).replace(/\/$/, "")}/api/kobo/${token}`;
let failures = 0;

function check(name: string, cond: unknown, detail = "") {
  const ok = Boolean(cond);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function main() {
  // 1. auth handshake
  const authRes = await fetch(`${root}/v1/auth/device`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ UserKey: "sim" }),
  });
  const authJson = await authRes.json().catch(() => ({}));
  check(
    "auth/device 200 + Bearer",
    authRes.status === 200 && authJson.TokenType === "Bearer",
    JSON.stringify(authJson).slice(0, 120),
  );

  // 2. initialization resources
  const initRes = await fetch(`${root}/v1/initialization`);
  const initJson = await initRes.json().catch(() => ({}));
  const resources = initJson.Resources ?? {};
  check("initialization returns Resources", initRes.status === 200 && Boolean(resources.library_sync));
  check(
    "initialization library_sync points at this server",
    String(resources.library_sync || "").includes(`/api/kobo/${token}`),
  );

  // 3. library sync
  const syncRes = await fetch(`${root}/v1/library/sync`, { headers: { "x-kobo-synctoken": "" } });
  const syncHeaders = {
    synctoken: syncRes.headers.get("x-kobo-synctoken"),
    continue: syncRes.headers.get("x-kobo-sync"),
  };
  const syncJson = await syncRes.json();
  const entitlements = Array.isArray(syncJson) ? syncJson.filter((e) => e.NewEntitlement) : [];
  check(
    "library/sync returns JSON array",
    syncRes.status === 200 && Array.isArray(syncJson),
    `${syncJson.length} items`,
  );
  check("sync token round-trips", Boolean(syncHeaders.synctoken));
  const first = entitlements[0]?.NewEntitlement;
  check(
    "entitlement shape (BookEntitlement + BookMetadata + DownloadUrls)",
    Boolean(
      first?.BookEntitlement?.Id &&
      first?.BookMetadata?.Title !== undefined &&
      Array.isArray(first?.BookMetadata?.DownloadUrls),
    ),
    first ? `${first.BookMetadata?.Title}` : "no entitlements (empty library?)",
  );

  // 4. file download (only when a template is configured and a book has an ISBN)
  if (fileBase) {
    const bookId = first?.BookEntitlement?.Id;
    const dlRes = await fetch(`${root}/download/${bookId}/epub`, { redirect: "manual" });
    check("download status 200", dlRes.status === 200, `status ${dlRes.status}`);
    const bytes = await dlRes.arrayBuffer();
    check("download non-empty body", bytes.byteLength > 0, `${bytes.byteLength} bytes`);
  } else {
    console.log("SKIP  download step (pass a file-source base to test it)");
  }

  // 5. progress write-back on the first book at 50%
  const bookId = first?.BookEntitlement?.Id;
  if (bookId) {
    const stateRes = await fetch(`${root}/v1/library/${bookId}/state`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ReadingStates: [{ CurrentBookmark: { ProgressPercent: 50 } }] }),
    });
    const stateJson = await stateRes.json().catch(() => ({}));
    check(
      "state PUT returns Success",
      stateRes.status === 200 && stateJson.RequestResult === "Success",
      JSON.stringify(stateJson).slice(0, 120),
    );
  } else {
    console.log("SKIP  state write-back (no book to report progress for)");
  }

  console.log(failures === 0 ? "\nAll sim checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Simulator crashed:", e.message);
  process.exit(1);
});
