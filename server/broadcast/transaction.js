export async function transaction(ref, update) {
    let listener;
    try {
        // Keep a listener attached until commit: a one-shot get() does not retain the SDK's transaction cache.
        await new Promise((resolve, reject) => {
            listener = () => resolve();
            ref.on("value", listener, reject);
        });
        return await ref.transaction(update, undefined, false);
    } finally {
        if (listener) ref.off("value", listener);
    }
}
