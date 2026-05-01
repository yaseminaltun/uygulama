export default function SportBadge({ sport }) {
  return <span className={`sport-badge sport-${sport.toLowerCase()}`}>{sport}</span>;
}
