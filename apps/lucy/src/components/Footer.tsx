interface FooterProps {
  year?: number;
}

function getFooterYear() {
  return new Date().getFullYear();
}

export const Footer = (props: FooterProps) => {
  const year = props.year ?? getFooterYear();
  const copyright = year ? `All rights reserved ${year}` : "All rights reserved";
  return (
    <footer className="py-8 px-12 xl:px-28 border-t border-gray-200">
      <p className="text-sm text-gray-500">{copyright}</p>
    </footer>
  );
};
