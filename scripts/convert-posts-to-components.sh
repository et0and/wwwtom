#!/bin/bash
# Temporary script to convert posts from frontmatter format to component format

cd "$(dirname "$0")/.."

for file in src/routes/posts/*.mdx; do
  if [ -f "$file" ] && [ "$(basename "$file")" != "index.mdx" ]; then
    echo "Converting $file..."
    
    # Extract frontmatter data
    title=$(grep '^title:' "$file" | sed 's/title: *"//; s/"$//')
    summary=$(grep '^summary:' "$file" | sed 's/summary: *"//; s/"$//')
    published=$(grep '^publishedAt:' "$file" | sed 's/publishedAt: *"//; s/"$//')
    
    # Create backup
    cp "$file" "$file.backup"
    
    # Extract content after frontmatter (everything after the second ---)
    content=$(sed '1,/^---$/d; /^---$/,$d' "$file")
    
    # Write new format
    cat > "$file" << EOF
import PageLayout from "~/components/PageLayout";

export const frontmatter = {
  title: "$title",
  summary: "$summary", 
  publishedAt: "$published"
};

<PageLayout title="$title" description="$summary">

$content

</PageLayout>
EOF
    
    echo "Converted $file (backup saved as $file.backup)"
  fi
done

echo "Conversion complete! Run the generation script to update types."