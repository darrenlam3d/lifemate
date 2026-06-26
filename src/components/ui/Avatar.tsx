interface AvatarProps {
  name: string;
  color?: string;
  size?: number;
}

export function Avatar({ name, color = '#6366f1', size = 36 }: AvatarProps) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div
      className="flex items-center justify-center rounded-full font-semibold text-white"
      style={{ backgroundColor: color, width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </div>
  );
}
