// Drains the outbox to the server.
//
// Conflict resolution is LAST-WRITE-WINS, by necessity rather than by choice:
// the Contacts API exposes no version, ETag or updated_at, so there is no way to
// detect that a record changed under us. Two devices editing the same contact
// offline means the later sync silently overwrites the earlier. This is
// documented in docs/system.md.
//
// Failure policy, per operation:
//   401  → stop; the token is gone. Keep the queue for after re-auth.
//   404  → the record is gone server-side. Drop the op, reconcile locally.
//   422  → the server will never accept this. Drop it and report, rather than
//          retrying forever and wedging everything behind it.
//   else → treat as transient (offline, 5xx). Stop and keep the op for the next
//          flush; sending later ops now would apply changes out of order.

export function createSync({ outbox, kv, remote, onUnauthorized }) {
	let inFlight = null;

	async function apply(op) {
		if (op.type === 'create') {
			const created = (await remote.create(op.payload)).data;
			// Swap the temporary record for the server's, then repoint anything
			// still queued against the temp id — otherwise the next op would be
			// sent for an id the server has never seen.
			await kv.del(op.contactId);
			await kv.set(created.id, created);
			await outbox.remapContactId(op.contactId, created.id);
			return;
		}

		if (op.type === 'update') {
			const updated = (await remote.update(op.contactId, op.payload)).data;
			await kv.set(updated.id, updated);
			return;
		}

		await remote.remove(op.contactId);
		await kv.del(op.contactId);
	}

	async function run() {
		const rejected = [];

		for (;;) {
			// Re-read each time: applying a create remaps ids on the ops behind it,
			// so a list captured up front would go stale.
			const [op] = await outbox.list();
			if (!op) {
				return { rejected, stopped: null };
			}

			try {
				// Mark before sending: once the request is away, an edit arriving
				// mid-flight must queue separately rather than be folded into this
				// operation (the payload has already left).
				await outbox.markSending(op.id);
				await apply(op);
				await outbox.remove(op.id);
			} catch (error) {
				// The operation is staying in the queue in every branch below that
				// does not remove it, so it is no longer in flight.
				await outbox.markSending(op.id, false);

				if (error?.status === 401) {
					onUnauthorized?.();
					return { rejected, stopped: 'unauthorized' };
				}

				if (error?.status === 404 && op.type !== 'create') {
					await outbox.remove(op.id);
					await kv.del(op.contactId);
					continue;
				}

				if (error?.status === 422) {
					await outbox.remove(op.id);
					rejected.push({ op, error });
					continue;
				}

				return { rejected, stopped: 'network' };
			}
		}
	}

	/**
	 * Drain the queue. Serialized: start-up and the `online` event routinely fire
	 * together, and two concurrent drains would send the same operation twice.
	 */
	function flush() {
		if (!inFlight) {
			inFlight = run().finally(() => {
				inFlight = null;
			});
		}

		return inFlight;
	}

	return { flush };
}
