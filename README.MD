# ENV

⏺ You need a GitHub Personal Access Token. Here's how to get it:

1. Go to https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Give it a name like "Issue Router"
4. Set expiration (recommend 30 days or custom)
5. Select scopes: Check "public_repo" (or just "repo" if you want full
   access)
6. Click "Generate token"
7. Copy the token immediately (you won't see it again)
8. Add it to the .env file



# Database Setup

## Prerequisites
- Docker and Docker Compose installed
- Environment variables configured in `.env` file

## Setup Steps

1. **Start the PostgreSQL database with pgvector extension:**
   ```bash
   pnpm run db:start
   ```

2. Wait for the database to initialize (about 5-10 seconds), then enable the vector extension:
```shell
   docker exec -it issue-router-db psql -U abcadmin -d issue_router -c 'CREATE EXTENSION IF NOT EXISTS vector;'
```
3. Verify the setup:
    ```shell
   docker exec -it issue-router-db psql -U abcadmin -d issue_router -c 'SELECT version();'
```
