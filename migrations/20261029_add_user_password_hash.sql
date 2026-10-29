-- Additive migration for owner-provisioned MySQL authentication.
-- Existing accounts remain intact and cannot sign in until a password is set
-- with the server-side user-password provisioning command.
ALTER TABLE users
  ADD COLUMN password_hash VARCHAR(255) NULL;
