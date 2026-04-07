import { cacheLife } from "next/cache";

interface FooterProps {
  year?: number;
}

async function getFooterYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

export const Footer = async (props: FooterProps) => {
  const year = props.year ?? (await getFooterYear());
  const copyright = year ? `All rights reserved ${year}` : "All rights reserved";
  return (
    <footer className="py-8 px-12 xl:px-28 border-t border-gray-200">
      <p className="text-sm text-gray-500">{copyright}</p>
    </footer>
  );
};
