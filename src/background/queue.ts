// The service worker can receive several events at once (an alarm, a popup click,
// a blocklist edit). Timer updates and blocking updates each read, change and
// write shared data, so two at the same time could overwrite each other. This
// queue runs them one by one, in order.

let queue: Promise<unknown> = Promise.resolve();

export function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task);
  queue = run.catch(() => undefined); // a failed task must not block later ones
  return run;
}
