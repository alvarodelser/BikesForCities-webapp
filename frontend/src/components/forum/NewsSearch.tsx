import React from 'react';

interface NewsSearchProps {
  value: string;
  onChange: (value: string) => void;
}

const NewsSearch: React.FC<NewsSearchProps> = ({ value, onChange }) => {
  return (
    <div className="px-4 py-3 border-b-2 border-[var(--blue)] bg-[var(--cream)]">
      <input
        type="text"
        placeholder="Buscar noticias..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[var(--cream)] text-[var(--black)] placeholder-[var(--black)] placeholder-opacity-40 border-b-2 border-[var(--blue)] outline-none font-body text-base py-2 px-1 transition-colors"
      />
    </div>
  );
};

export default NewsSearch;
