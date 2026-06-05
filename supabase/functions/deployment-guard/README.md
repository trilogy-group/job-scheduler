# deployment-guard

This Edge Function is a cost-control watchdog for Fireworks deployments on the
`trilogy` account. On each invocation it lists every deployment (paginating
through `nextPageToken`), finds any in the `READY` state whose
`minReplicaCount` is greater than `0`, and PATCHes them back to
`minReplicaCount=0` (preserving each deployment's existing `maxReplicaCount`
and `baseModel`). This keeps idle deployments from holding a warm GPU replica —
and incurring charges — indefinitely. Every successful reset writes an audit
row to the `deployment_replica_audit` table capturing the deployment name, the
old/new minimum replica counts, the max replica count, and the observed state.

**Auth:** Same pattern as `scheduler-tick`. Requests must present the
`X-Scheduler-Secret` header matching the `SCHEDULER_SECRET` env var (otherwise
`401`). The function also requires `FIREWORKS_API_KEY` in the environment
(otherwise `500`) to call the Fireworks API, plus the standard
`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` for the audit-table writes.

**Schedule:** Runs every 30 minutes, triggered by `pg_cron` invoking this
function with the shared scheduler secret header. The response summarizes the
sweep as `{ checked, reset, errors, details }`.
