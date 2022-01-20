(async function () {
    globalThis.electron = await require("electron")
    await import("./main.cjs")
  })()
