# Wagtail Headless CMS Setup for wwwtom

This directory contains the Wagtail-based headless CMS ported from the Strapi schema.

## Overview

The Strapi schema has been converted to Wagtail models with the following mappings:

### Content Types

- **Article**: Wagtail Page with title, description, slug, cover image, author, category, and dynamic blocks
- **Author**: Wagtail Page with name, avatar, email
- **Category**: Wagtail Page with name, slug, description
- **Post**: Wagtail Page with title, summary, slug, rich text content, featured image, publication date
- **Work**: Similar to Post, for portfolio items
- **About**: Single Wagtail Page with title and dynamic blocks
- **Global**: Snippet model for site-wide settings including SEO defaults

### Components (Blocks)

- **Shared Media**: Block for images, documents, or videos
- **Shared Quote**: Block with title and body text
- **Shared Rich Text**: Block with rich text content
- **Shared Slider**: Block with multiple images
- **SEO**: Fields for meta title, description, and share image (used in Global settings)

## API Endpoints

The Wagtail API v2 is configured to expose the content via REST endpoints:

- `/api/v2/authors/` - Author pages
- `/api/v2/categories/` - Category pages
- `/api/v2/articles/` - Article pages
- `/api/v2/posts/` - Post pages
- `/api/v2/works/` - Work pages
- `/api/v2/about/` - About page
- `/api/v2/snippets/find/?type=content.GlobalSettings` - Global settings

## Connecting to Frontend

To connect your Solid Start/TypeScript frontend to Wagtail instead of Strapi:

1. Update your API base URL from Strapi to Wagtail (e.g., `http://localhost:8000/api/v2/`)

2. Adjust API calls:
   - Strapi uses `/api/articles` → Wagtail uses `/api/v2/articles/`
   - Response format may differ; Wagtail API returns data in `items` array

3. Handle media URLs: Wagtail serves media at `/media/`, ensure your frontend handles absolute URLs or configure CORS.

4. For dynamic blocks in Articles and About, parse the StreamField JSON structure.

5. Global settings are accessed via snippets endpoint.

## Deployment Options

Since your frontend is deployed on Cloudflare, here are low-cost deployment options for the Wagtail backend:

### 1. Cloudflare Containers (Recommended for Cloudflare ecosystem)

- **Cost**: Starts free, then $0.0025 per GB-hour
- **Setup**:
  1. Build Docker image for the Wagtail app
  2. Push to Cloudflare Container Registry
  3. Deploy to Cloudflare Workers (Containers)
  4. Use Cloudflare D1 for database (SQLite alternative) or connect to external DB

### 2. Railway

- **Cost**: $5/month for basic plan
- **Setup**: Deploy Django app directly, supports PostgreSQL

### 3. Fly.io

- **Cost**: Free tier available, then $0.02/GB RAM/hour
- **Setup**: Deploy Docker container with Wagtail

### 4. DigitalOcean App Platform

- **Cost**: $5/month for static sites, more for containers
- **Setup**: Deploy from GitHub, supports Django

### 5. Render

- **Cost**: Free tier, then $7/month for web services
- **Setup**: Deploy from GitHub, supports Python/Django

### 6. Vercel (for serverless)

- **Cost**: Free for hobby, then $20/month for pro
- **Setup**: Use Vercel's Python runtime for Django

### Recommended Approach: Cloudflare Containers

1. **Create Dockerfile**:
```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

RUN python manage.py collectstatic --noinput

EXPOSE 8000

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
```

2. **Build and deploy**:
   - Use Wrangler CLI to deploy to Cloudflare Containers
   - Configure environment variables for SECRET_KEY, DEBUG=False
   - Use Cloudflare D1 for database or external PostgreSQL

3. **Domain**: Use a subdomain like `cms.yourdomain.com`

4. **CORS**: Configure CORS in Django settings to allow your frontend domain

## Migration Steps

1. Export data from Strapi (JSON)
2. Write a Django management command to import data into Wagtail models
3. Migrate media files to Wagtail
4. Update frontend API calls
5. Test thoroughly
6. Deploy Wagtail backend
7. Switch frontend to use Wagtail API

## Best Practices

- Use environment variables for secrets
- Enable Django's security features (HTTPS, CSRF, etc.)
- Set up proper logging and monitoring
- Use PostgreSQL in production instead of SQLite
- Configure backups for database and media files
- Set up CI/CD for automated deployments
