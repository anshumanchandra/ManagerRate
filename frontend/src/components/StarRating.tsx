/* ========================================
   StarRating — Display & Interactive
   ======================================== */

interface StarDisplayProps {
  rating: number;
  size?: number;
}

export function StarDisplay({ rating, size = 13 }: StarDisplayProps) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(rating)) {
      stars.push(<i key={i} className="fa-solid fa-star text-star" style={{ fontSize: size }} />);
    } else if (i - 0.5 <= rating) {
      stars.push(<i key={i} className="fa-solid fa-star-half-stroke text-star" style={{ fontSize: size }} />);
    } else {
      stars.push(<i key={i} className="fa-regular fa-star text-gray-300" style={{ fontSize: size }} />);
    }
  }
  return <span className="inline-flex gap-0.5">{stars}</span>;
}

interface StarInputProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
}

export function StarInput({ label, value, onChange }: StarInputProps) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="w-40 text-sm text-gray-600 flex-shrink-0 truncate">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            className="hover:scale-110 transition-transform"
            aria-label={`Rate ${i} star${i > 1 ? 's' : ''}`}
          >
            <i
              className={`text-lg ${
                i <= value ? 'fa-solid fa-star text-star' : 'fa-regular fa-star text-gray-300'
              }`}
            />
          </button>
        ))}
      </div>
      {value > 0 && <span className="text-xs font-mono font-bold text-gray-500">{value}/5</span>}
    </div>
  );
}
