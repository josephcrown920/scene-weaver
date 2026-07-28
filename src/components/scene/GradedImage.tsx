import { gradeCss, tintRgba, type Grade } from "@/lib/grade";

export function GradedImage({
  src,
  grade,
  alt = "",
  className = "",
  imgClassName = "h-full w-full object-cover",
}: {
  src: string;
  grade: Grade;
  alt?: string;
  className?: string;
  imgClassName?: string;
}) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <img src={src} alt={alt} className={imgClassName} style={{ filter: gradeCss(grade) }} />
      {grade.diffusion > 0 && (
        <img
          src={src}
          alt=""
          aria-hidden
          className={`pointer-events-none absolute inset-0 ${imgClassName}`}
          style={{
            filter: `${gradeCss(grade)} blur(${Math.max(2, grade.diffusion / 5)}px)`,
            opacity: Math.min(0.5, grade.diffusion / 200),
            mixBlendMode: "screen",
          }}
        />
      )}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: tintRgba(grade), mixBlendMode: "overlay" }}
      />
      {grade.vignette > 0 && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 35%, rgba(0,0,0,${Math.min(
              0.85,
              grade.vignette / 100,
            )}) 100%)`,
          }}
        />
      )}
    </div>
  );
}
