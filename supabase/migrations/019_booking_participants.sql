-- Additional invitee emails beyond the primary requester/host, for booking
-- multiple people onto one call (all get added as Calendar event attendees
-- and receive the confirmation email + .ics).
alter table public.bookings add column if not exists participant_emails text[] not null default '{}';
