# Strapi Migration Guide

This guide explains how to migrate your MDX content from the file-based system to Strapi CMS.

## Setup

### 1. Configure B2 Backblaze Storage

In your Strapi Cloud dashboard or local `.env` file, add the following environment variables:

```bash
B2_APPLICATION_KEY_ID=0053e46ce6809310000000002
B2_APPLICATION_KEY=K005xwuZ7Y3FCNMr9ikvEV1cVKf8Qzk
B2_ENDPOINT=https://s3.us-west-005.backblazeb2.com
B2_REGION=us-west-005
B2_BUCKET_NAME=tomso
B2_ROOT_PATH=strapi
CDN_URL=https://cdn.tom.so
```

**B2 Bucket Setup:**

1. Create a new bucket in Backblaze B2
2. Set it to **Public** access
3. Generate Application Key with read/write permissions
4. Configure CORS settings in B2:
   ```json
   [
   	{
   		"corsRuleName": "strapi-uploads",
   		"allowedOrigins": [
   			"https://your-strapi-domain.strapiapp.com",
   			"http://localhost:1337"
   		],
   		"allowedOperations": ["s3_get", "s3_put", "s3_head"],
   		"allowedHeaders": ["*"],
   		"maxAgeSeconds": 3600
   	}
   ]
   ```

**CDN Setup:**

1. Point `cdn.tom.so` CNAME to your B2 bucket endpoint
2. Or use CloudFlare in front of B2 for better caching

### 2. Deploy Strapi to Strapi Cloud

1. Push your changes to GitHub:

   ```bash
   git add strapi/
   git commit -m "Add Post and Work content types with B2 upload provider"
   git push
   ```

2. In Strapi Cloud dashboard:
   - Connect your GitHub repository
   - Select the `strapi` folder as the project directory
   - Add the B2 environment variables above
   - Deploy

3. Once deployed, access the admin panel at `https://your-project.strapiapp.com/admin`

### 3. Create API Token

1. Log into Strapi admin panel
2. Go to **Settings** → **API Tokens**
3. Click **Create new API Token**
4. Settings:
   - Name: `Migration Script`
   - Token duration: `Unlimited` (or set expiry)
   - Token type: `Full access`
5. Copy the generated token

### 4. Run Migration

Set your API token and run the migration script:

```bash
# For Strapi Cloud
export STRAPI_URL=https://your-project.strapiapp.com
export STRAPI_API_TOKEN=your_api_token_here

# For local Strapi (default: http://localhost:1337)
export STRAPI_API_TOKEN=your_api_token_here

# Run migration
bun run migrate:strapi
```

The script will:

- Parse all MDX files in `src/routes/posts/` and `src/routes/work/`
- Extract frontmatter (title, summary, publishedAt)
- Convert MDX content to markdown
- Create documents in Strapi
- Publish all documents

## Content Structure

### Post Content Type

- **title** (string, required)
- **summary** (text, required)
- **publishedAt** (date, required)
- **slug** (uid, generated from title)
- **content** (richtext, required)
- **featuredImage** (media, optional)

### Work Content Type

Same structure as Post.

## Uploading Images

Once Strapi is running:

1. Go to **Media Library** in admin panel
2. Upload images - they'll automatically go to B2
3. Images will be accessible at `https://cdn.tom.so/strapi/filename.jpg`
4. Attach images to posts/work via the **featuredImage** field

## Fetching Content in Frontend

Replace your current MDX imports with Strapi API calls:

```typescript
// Fetch all posts
async function getPosts() {
	const res = await fetch(
		"https://your-project.strapiapp.com/api/posts?sort=publishedAt:desc&populate=*",
	);
	const data = await res.json();
	return data.data;
}

// Fetch single post by slug
async function getPost(slug: string) {
	const res = await fetch(
		`https://your-project.strapiapp.com/api/posts?filters[slug][$eq]=${slug}&populate=*`,
	);
	const data = await res.json();
	return data.data[0];
}
```

## Notes

- The migration script uses `eval()` to parse frontmatter - only run on trusted MDX files
- Content is converted to Strapi's richtext format (blocks-based)
- You may need to manually adjust formatting for complex MDX content
- Images referenced in MDX need to be uploaded to B2 separately
- Consider adding a markdown-to-richtext converter for better formatting
