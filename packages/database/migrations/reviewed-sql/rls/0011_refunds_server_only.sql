-- Refunds: SERVER-ONLY.
--
-- A refund row carries the provider's refund id, the payment it reverses and
-- the amount returned to one specific family. No browser role has any business
-- reading it, and a column grant is per DATABASE ROLE, so it could not show one
-- family their own refund while hiding another's anyway. A family learns a
-- refund happened by being told — an email, and later a projection scoped to
-- their own payments — never by querying this table.
--
-- RLS is enabled with deliberately NO policies: deny-all for non-owners, the
-- fail-closed layer beneath the absent grants.

alter table payments.refunds enable row level security;
