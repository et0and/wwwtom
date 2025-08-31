#!/bin/bash
# Script to generate work route types from actual files

cd "$(dirname "$0")/.."

echo "// Auto-generated types for work routes" > src/types/work-routes.ts
echo "// This ensures your page links are type-safe against actual files" >> src/types/work-routes.ts
echo "" >> src/types/work-routes.ts

echo "export type WorkRoute = " >> src/types/work-routes.ts

# Find all .mdx files in work directory and convert to route paths
find src/routes/work -name "*.mdx" -type f | sed 's|src/routes||; s|\.mdx$||' | sort | sed 's|^|  \| "|; s|$|"|' >> src/types/work-routes.ts

echo ";" >> src/types/work-routes.ts
echo "" >> src/types/work-routes.ts
echo "export interface WorkPage {" >> src/types/work-routes.ts
echo "  href: WorkRoute;" >> src/types/work-routes.ts
echo "  text: string;" >> src/types/work-routes.ts
echo "}" >> src/types/work-routes.ts

echo "Generated work route types!"