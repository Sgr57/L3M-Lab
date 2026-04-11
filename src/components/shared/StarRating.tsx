export function StarRating({
  value,
  onChange,
  size = 'sm',
}: {
  value: number | null
  onChange: (rating: number) => void
  size?: 'sm' | 'lg'
}): React.JSX.Element {
  const textSize = size === 'sm' ? 'text-sm' : 'text-lg'

  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`cursor-pointer ${textSize} leading-none ${
            value !== null && star <= value
              ? 'text-star-filled'
              : 'text-star-empty'
          }`}
          onClick={() => onChange(star)}
        >
          &#9733;
        </button>
      ))}
    </span>
  )
}
