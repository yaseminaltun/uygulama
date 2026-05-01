export default function SectionHeader({ eyebrow, title, children }) {
  return (
    <header className="section-header">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <div>
        <h1>{title}</h1>
        {children && <p>{children}</p>}
      </div>
    </header>
  );
}
