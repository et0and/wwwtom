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
echo "" >> src/types/work-routes.ts

# Add helper function to convert route to title
echo "// Helper function to convert route to title" >> src/types/work-routes.ts
echo "const routeToTitle = (route: WorkRoute): string => {" >> src/types/work-routes.ts
echo "  return route" >> src/types/work-routes.ts
echo "    .replace(\"/work/\", \"\")" >> src/types/work-routes.ts
echo "    .split(\"-\")" >> src/types/work-routes.ts
echo "    .map(word => word.charAt(0).toUpperCase() + word.slice(1))" >> src/types/work-routes.ts
echo "    .join(\" \");" >> src/types/work-routes.ts
echo "};" >> src/types/work-routes.ts
echo "" >> src/types/work-routes.ts

# Generate the pages array
echo "// Export the pages array" >> src/types/work-routes.ts
echo "export const workPages: WorkPage[] = ([" >> src/types/work-routes.ts

# Generate array items for each route
find src/routes/work -name "*.mdx" -type f | sed 's|src/routes||; s|\.mdx$||' | sort | sed 's|^|  "|; s|$|",|' >> src/types/work-routes.ts

echo "] as WorkRoute[]).map(route => ({" >> src/types/work-routes.ts
echo "  href: route," >> src/types/work-routes.ts
echo "  text: routeToTitle(route)" >> src/types/work-routes.ts
echo "}));" >> src/types/work-routes.ts

echo "Generated work route types!"