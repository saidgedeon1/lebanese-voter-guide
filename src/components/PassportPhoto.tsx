import { useQuery } from "@tanstack/react-query";
import { listPersonFilesFn } from "@/lib/person-files";

const SIZE = {
  xs: "w-10 h-[3.3rem]",
  sm: "w-12 h-16",
  md: "w-16 h-[5.35rem]",
  lg: "w-24 h-32",
} as const;

export function PassportPhoto({
  personId,
  name,
  size = "md",
  className = "",
}: {
  personId?: number | null;
  name?: string;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const enabled = typeof personId === "number" && Number.isFinite(personId);
  const { data: files } = useQuery({
    queryKey: ["person-files", personId],
    queryFn: () => listPersonFilesFn({ data: personId! }),
    enabled,
    staleTime: 60_000,
  });

  const photo = files?.find((f) => f.docType === "photo");
  const initials = (name ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("");

  return (
    <div
      className={`passport-photo relative shrink-0 overflow-hidden bg-[#f3f1ec] ${SIZE[size]} ${className}`}
      title={name || "صورة شخصية"}
    >
      {photo ? (
        <img
          src={photo.url}
          alt={name || "صورة شخصية"}
          className="absolute inset-0 h-full w-full object-cover object-[center_18%]"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-[0.65rem] font-bold text-muted-foreground/70">
          {initials || "—"}
        </div>
      )}
    </div>
  );
}
