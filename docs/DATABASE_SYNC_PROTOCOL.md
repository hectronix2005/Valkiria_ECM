# Database Synchronization Protocol - VALKYRIA ECM

## Overview

This document describes the protocol for keeping local and production MongoDB databases synchronized. Follow these guidelines to avoid data loss and ensure consistency.

## Quick Reference

```bash
# View sync status
rake db:sync:status

# Sync local → production (after local development)
rake db:sync:to_production

# Sync production → local (get latest production data)
rake db:sync:from_production

# Backup commands
rake db:sync:backup:local
rake db:sync:backup:production
rake db:sync:backup:list

# Sync specific collection
rake db:sync:collection_to_production[collection_name]
rake db:sync:collection_from_production[collection_name]
```

## Golden Rules

### 1. Single Source of Truth
- **Development changes** → Always sync FROM local TO production
- **Production data changes** (user edits via UI) → Sync FROM production TO local before any local work

### 2. Always Backup First
The sync tasks automatically backup before destructive operations, but you can also manually backup:
```bash
rake db:sync:backup:production  # Before syncing TO production
rake db:sync:backup:local       # Before syncing TO local
```

### 3. Post-Sync Password Reset
After syncing to production, passwords are automatically reset for key users. Current reset users:
- `hectorneira2005@hotmail.com`
- `legal@valkyria.com`
- `admin@valkyria.com`

Default password after sync: `Admin123`

## Workflows

### Workflow A: After Local Development (Most Common)

When you've made changes locally (code + data) and want to deploy:

```bash
# 1. Commit and push code
git add . && git commit -m "Your changes" && git push heroku main

# 2. Sync database to production
rake db:sync:to_production
```

### Workflow B: Starting Work (Get Latest Production Data)

Before starting work, get the latest production data:

```bash
# 1. Pull latest code
git pull origin main

# 2. Sync production data to local
rake db:sync:from_production
```

### Workflow C: Someone Made Changes in Production

If someone (like the admin) made changes directly in production (e.g., changed a user's name):

```bash
# 1. Sync production → local FIRST
rake db:sync:from_production

# 2. Now make your local changes
# ... do your work ...

# 3. Sync back to production
rake db:sync:to_production
```

### Workflow D: Sync Only Specific Data

For syncing just one collection (faster, less risky):

```bash
# Sync users from production to local
rake db:sync:collection_from_production[identity_users]

# Sync templates from local to production
rake db:sync:collection_to_production[templates_templates]
```

## Available Collections

| Collection | Description |
|------------|-------------|
| `organizations` | Organizations |
| `permissions` | System permissions |
| `roles` | User roles |
| `departments` | Departments |
| `users` | Users |
| `hr_employees` | Employee records |
| `hr_vacation_requests` | Vacation requests |
| `hr_certification_requests` | Certification requests |
| `legal_third_party_types` | Third party types |
| `legal_third_parties` | Third parties |
| `legal_contracts` | Contracts |
| `generated_documents` | Generated documents |
| `templates` | Document templates |
| `template_signatories` | Template signatories |
| `signatory_types` | Signatory types |
| `variable_mappings` | Variable mappings |
| `content_documents` | Content documents |
| `user_signatures` | User signatures |
| `audit_events` | Audit events |
| `fs.files` | GridFS files metadata |
| `fs.chunks` | GridFS file contents |

## Troubleshooting

### "Cannot fetch production URI"
Ensure you're logged into Heroku:
```bash
heroku login
heroku apps  # Should show 'valkyria'
```

### Sync completed but login doesn't work
Passwords were reset. Use `Admin123` for key users, or check if reset_password.rb ran:
```bash
heroku run "rails runner db/seeds/reset_password.rb" -a valkyria
```

### File attachments missing after sync
Ensure `fs.files` and `fs.chunks` collections are included. These contain GridFS data (templates, documents).

### Restore from backup
```bash
# List available backups
rake db:sync:backup:list

# Restore local from a backup
rake db:sync:backup:restore_local[local_20260111_103000]
```

## Environment Variables

The sync tasks use:
- **Local**: `localhost:27017` / `valkyria_ecm_development`
- **Production**: `MONGODB_URI` from Heroku config

## CI/CD Integration

For automated deployments, use the `FORCE=true` environment variable to skip confirmation prompts:

```bash
FORCE=true rake db:sync:to_production
```

## Best Practices

1. **Daily workflow**: Start with `rake db:sync:from_production` to get latest data
2. **Before deploy**: Always run `rake db:sync:to_production` after pushing code
3. **After production changes**: Immediately sync to local to preserve changes
4. **Large changes**: Use full sync; small changes can use collection sync
5. **Keep backups**: Backups are auto-cleaned (keeps last 5), but critical data should be exported separately

## Emergency Recovery

If something goes wrong:

1. **Check backups**: `rake db:sync:backup:list`
2. **Restore local**: `rake db:sync:backup:restore_local[backup_name]`
3. **For production**: Use MongoDB Atlas UI or contact support

## Contact

For issues with sync, check:
- Heroku logs: `heroku logs --tail -a valkyria`
- MongoDB Atlas dashboard for connection issues
- Local MongoDB: `mongosh valkyria_ecm_development`
