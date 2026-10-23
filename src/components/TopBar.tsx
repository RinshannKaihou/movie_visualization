import { useGraphStore } from '../stores/graphStore';
import { SearchBox } from './SearchBox';

export const TopBar = () => {
  const count = useGraphStore(s => s.dataset?.nodes.length ?? 0);
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-void-0/90 via-void-0/40 to-transparent px-4 pb-10 pt-4 md:px-7 md:pt-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-8">
        <div className="pointer-events-auto shrink-0">
          <p className="eyebrow flex items-center gap-2.5 text-[9px]!">
            <span className="size-1.5 rounded-full bg-aurora shadow-[0_0_10px_var(--color-aurora)]" />
            Catalog · N1
          </p>
          <h1 className="display mt-1 text-[30px] leading-none text-starlight [text-shadow:0_0_24px_rgb(255_251_230/0.2),0_0_60px_rgb(169_156_255/0.18)] md:text-[34px]">
            CineVerse
          </h1>
          <p className="eyebrow mt-2 hidden md:block">
            {count.toLocaleString('en')} films · charted by kinship
          </p>
        </div>
        <div className="pointer-events-auto w-full md:mx-auto md:max-w-[440px] md:pt-1.5">
          <SearchBox />
        </div>
        {/* Balances the brand column so the search box stays centered. */}
        <div className="hidden w-[150px] shrink-0 lg:block" />
      </div>
    </header>
  );
};
