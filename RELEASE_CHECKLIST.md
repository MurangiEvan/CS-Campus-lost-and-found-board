# CampusLink Release Checklist

## Release readiness

- [ ] Database schema is created and verified
- [ ] JWT secret is provided and not left at a default value in production
- [ ] CORS is restricted to approved domains
- [ ] API health check returns 200
- [ ] API readiness check returns 200 with a reachable database
- [ ] Client app loads successfully without console 500s
- [ ] Auth register/login flows work
- [ ] Item create/read/update/delete/resolve flows work
- [ ] Ownership enforcement is enforced server-side
- [ ] Production environment variables are documented
- [ ] Search taxonomy, full-text index, date/location filters, and resolution history schema are applied
- [ ] Search/filter and resolution regression tests pass
- [ ] Smoke test covers registration, login, report creation, search, and resolution
- [ ] Backup/restore procedure is ready
- [ ] Known limitations are explicitly documented

## Known gaps before broad release

- Notification persistence is still prototype-only
- Contact preferences are not fully database-backed
- Image upload pipeline is incomplete
- Security match workflow is limited
- Vercel/Render launch remains pending until provider credentials and a reachable production database are available
