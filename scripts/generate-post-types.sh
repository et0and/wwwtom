#!/bin/bash
# Script to generate post route types from actual files

cd "$(dirname "$0")/.."

echo "// Auto-generated types for post routes" > src/types/post-routes.ts
echo "// This ensures your page links are type-safe against actual files" >> src/types/post-routes.ts
echo "" >> src/types/post-routes.ts

echo "export type PostRoute = " >> src/types/post-routes.ts

# Find all .mdx files in posts directory and convert to route paths
find src/routes/posts -name "*.mdx" -type f | sed 's|src/routes||; s|\.mdx$||' | sort | sed 's|^|  \| "|; s|$|"|' >> src/types/post-routes.ts

echo ";" >> src/types/post-routes.ts
echo "" >> src/types/post-routes.ts
echo "export interface PostPage {" >> src/types/post-routes.ts
echo "  href: PostRoute;" >> src/types/post-routes.ts
echo "  title: string;" >> src/types/post-routes.ts
echo "  summary: string;" >> src/types/post-routes.ts
echo "  publishedAt: string;" >> src/types/post-routes.ts
echo "}" >> src/types/post-routes.ts
echo "" >> src/types/post-routes.ts

# Export the posts array with frontmatter data
echo "// Export the posts array with extracted frontmatter data" >> src/types/post-routes.ts
echo "export const postPages: PostPage[] = ([" >> src/types/post-routes.ts

# Generate post data for each MDX file
for file in src/routes/posts/*.mdx; do
  if [ -f "$file" ] && [ "$(basename "$file")" != "index.mdx" ]; then
    route=$(echo "$file" | sed 's|src/routes||; s|\.mdx$||')
    
    # Extract frontmatter from the exported object
    title=$(grep 'title:' "$file" | head -1 | sed 's/.*title: *"//; s/".*//')
    summary=$(grep 'summary:' "$file" | head -1 | sed 's/.*summary: *"//; s/".*//')
    published=$(grep 'publishedAt:' "$file" | head -1 | sed 's/.*publishedAt: *"//; s/".*//')
    
    echo "  {" >> src/types/post-routes.ts
    echo "    href: \"$route\"," >> src/types/post-routes.ts
    echo "    title: \"$title\"," >> src/types/post-routes.ts
    echo "    summary: \"$summary\"," >> src/types/post-routes.ts
    echo "    publishedAt: \"$published\"" >> src/types/post-routes.ts
    echo "  }," >> src/types/post-routes.ts
  fi
done

echo "] as PostPage[]).sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());" >> src/types/post-routes.ts

echo "Generated post route types!"