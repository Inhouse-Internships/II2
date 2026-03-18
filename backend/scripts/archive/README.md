# Archive Scripts

These are one-time migration/utility scripts used during development.
They are kept for reference but should NOT be run in production unless
you specifically need to perform the named migration.

| Script | Purpose |
|---|---|
| migrate_emails.js | One-time: normalized email casing in DB |
| migrate_passwords.js | One-time: rehashed passwords to bcrypt |
| reset_admin.js | Emergency: resets admin credentials |
| sync_indexes.js | One-time: created MongoDB indexes |
| capture_boot.js | Debug: captured server boot sequence |
| test_team_leader.js | Debug: tested team leader assignment |
